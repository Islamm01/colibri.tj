import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { writeSession } from '@/lib/session/server';
import { notifyUsers } from '@/lib/push/notify';
import { normalizePhone, isValidName, isValidLatLng } from '@/lib/validation';
import {
  generatePublicCode,
  distanceKm,
  calculateDeliveryFee,
} from '@/lib/orders/pricing';
import type { PaymentMethod } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface CheckoutItem {
  product_id: string;
  quantity: number;
}

interface CheckoutPayload {
  idempotency_key: string;
  contact: { phone: string; name: string };
  address: {
    formatted_address: string;
    details?: string;
    lat: number;
    lng: number;
  };
  payment_method: PaymentMethod;
  notes?: string;
  items: CheckoutItem[];
}

export async function POST(request: Request) {
  let payload: CheckoutPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // -----------------------------------------------------------------
  // 1. VALIDATE
  // -----------------------------------------------------------------
  const idempotencyKey = payload.idempotency_key;
  if (!idempotencyKey || !/^[0-9a-f-]{36}$/i.test(idempotencyKey)) {
    return NextResponse.json({ error: 'invalid_idempotency_key' }, { status: 400 });
  }

  const phone = normalizePhone(payload.contact?.phone ?? '');
  if (!phone) return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });

  if (!isValidName(payload.contact?.name ?? '')) {
    return NextResponse.json({ error: 'invalid_name' }, { status: 400 });
  }
  const name = payload.contact.name.trim();

  const coords = isValidLatLng(payload.address?.lat, payload.address?.lng);
  if (!coords) return NextResponse.json({ error: 'invalid_address' }, { status: 400 });

  if (!payload.address?.formatted_address?.trim()) {
    return NextResponse.json({ error: 'missing_address_text' }, { status: 400 });
  }

  if (!['cash', 'qr', 'bank_transfer'].includes(payload.payment_method)) {
    return NextResponse.json({ error: 'invalid_payment_method' }, { status: 400 });
  }

  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    return NextResponse.json({ error: 'empty_cart' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // -----------------------------------------------------------------
  // 2. IDEMPOTENCY CHECK — return existing order if same key
  // -----------------------------------------------------------------
  const { data: existing } = await supabase
    .from('orders')
    .select('id, public_code, status, total, payment_method, payment_status')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      order: {
        id: existing.id,
        public_code: existing.public_code,
        status: existing.status,
        total: existing.total,
        payment_method: existing.payment_method,
        payment_status: existing.payment_status,
      },
      idempotent_replay: true,
    });
  }

  // -----------------------------------------------------------------
  // 3. LOAD PRODUCTS & VALIDATE STOCK / STORE
  // -----------------------------------------------------------------
  const productIds = payload.items.map((i) => i.product_id);
  const { data: products, error: productsErr } = await supabase
    .from('products')
    .select('id, store_id, name_tj, name_ru, price, unit, stock, is_available')
    .in('id', productIds);

  if (productsErr || !products || products.length === 0) {
    return NextResponse.json({ error: 'products_not_found' }, { status: 400 });
  }

  // All items must belong to the same store (single-store cart for v1)
  const storeIds = new Set(products.map((p) => p.store_id));
  if (storeIds.size !== 1) {
    return NextResponse.json({ error: 'mixed_stores' }, { status: 400 });
  }
  const storeId = products[0].store_id;

  // Check availability and stock
  for (const item of payload.items) {
    const product = products.find((p) => p.id === item.product_id);
    if (!product) {
      return NextResponse.json({ error: 'product_unavailable', product_id: item.product_id }, { status: 400 });
    }
    if (!product.is_available) {
      return NextResponse.json({ error: 'product_unavailable', product_id: item.product_id }, { status: 400 });
    }
    if (product.stock !== null && Number(item.quantity) > Number(product.stock)) {
      return NextResponse.json({
        error: 'insufficient_stock',
        product_id: item.product_id,
        available: product.stock,
      }, { status: 400 });
    }
  }

  // -----------------------------------------------------------------
  // 4. LOAD STORE + ZONE — for delivery fee calc
  // -----------------------------------------------------------------
  const { data: store } = await supabase
    .from('stores')
    .select('id, lat, lng, commission_rate, prep_time_minutes, is_paused, is_active')
    .eq('id', storeId)
    .maybeSingle();

  if (!store || !store.is_active || store.is_paused) {
    return NextResponse.json({ error: 'store_unavailable' }, { status: 400 });
  }

  const { data: zone } = await supabase
    .from('delivery_zones')
    .select('base_fee, included_km, per_km_rate, free_delivery_threshold')
    .eq('active', true)
    .limit(1)
    .maybeSingle();

  // -----------------------------------------------------------------
  // 5. CALCULATE TOTALS
  // -----------------------------------------------------------------
  let subtotal = 0;
  const itemRows = payload.items.map((item) => {
    const product = products.find((p) => p.id === item.product_id)!;
    const itemSubtotal = Number(product.price) * Number(item.quantity);
    subtotal += itemSubtotal;
    return {
      product_id: product.id,
      name_snapshot: product.name_tj, // We snapshot TJ; UI can refetch RU if needed later
      price_snapshot: product.price,
      unit_snapshot: product.unit,
      quantity: item.quantity,
      subtotal: itemSubtotal,
    };
  });

  const km = distanceKm(store.lat, store.lng, coords.lat, coords.lng);
  const feeBreakdown = calculateDeliveryFee({
    subtotal,
    distanceKm: km,
    baseFee: zone ? Number(zone.base_fee) : 15,
    includedKm: zone ? Number(zone.included_km) : 2,
    perKmRate: zone ? Number(zone.per_km_rate) : 3,
    freeDeliveryThreshold: zone?.free_delivery_threshold ? Number(zone.free_delivery_threshold) : null,
  });

  const total = subtotal + feeBreakdown.fee;
  const commission = Math.round(subtotal * Number(store.commission_rate) * 100) / 100;

  // -----------------------------------------------------------------
  // 6. SOFT-ACCOUNT: find or create user
  // -----------------------------------------------------------------
  let userId: string;
  const { data: existingUser } = await supabase
    .from('users')
    .select('id, name')
    .eq('phone', phone)
    .eq('role', 'customer')
    .maybeSingle();

  if (existingUser) {
    userId = existingUser.id;
    // Update name if changed
    if (existingUser.name !== name) {
      await supabase.from('users').update({ name }).eq('id', userId);
    }
  } else {
    const { data: newUser, error: userErr } = await supabase
      .from('users')
      .insert({ phone, name, role: 'customer' })
      .select('id')
      .single();
    if (userErr || !newUser) {
      return NextResponse.json({ error: 'user_create_failed', detail: userErr?.message }, { status: 500 });
    }
    userId = newUser.id;
  }

  // -----------------------------------------------------------------
  // 7. CREATE ADDRESS
  // -----------------------------------------------------------------
  const { data: address, error: addrErr } = await supabase
    .from('addresses')
    .insert({
      user_id: userId,
      label: null,
      formatted_address: payload.address.formatted_address.trim(),
      details: payload.address.details?.trim() ?? null,
      lat: coords.lat,
      lng: coords.lng,
      phone,
    })
    .select('id')
    .single();

  if (addrErr || !address) {
    return NextResponse.json({ error: 'address_create_failed' }, { status: 500 });
  }

  // -----------------------------------------------------------------
  // 8. CREATE ORDER + ITEMS
  // -----------------------------------------------------------------
  const publicCode = await generateUniquePublicCode(supabase);
  const paymentStatus = payload.payment_method === 'cash' ? 'pending' : 'pending';
  const orderStatus = payload.payment_method === 'cash' ? 'placed' : 'pending_payment';

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      public_code: publicCode,
      idempotency_key: idempotencyKey,
      customer_user_id: userId,
      customer_phone: phone,
      customer_name: name,
      store_id: storeId,
      address_id: address.id,
      subtotal,
      delivery_fee: feeBreakdown.fee,
      total,
      commission,
      payment_method: payload.payment_method,
      payment_status: paymentStatus,
      status: orderStatus,
      notes: payload.notes?.trim() || null,
      prep_eta_minutes: store.prep_time_minutes,
      delivery_eta_minutes: Math.round(km * 5) + 5, // 5 min per km + 5 min buffer
    })
    .select('id, public_code, status, total, payment_method, payment_status')
    .single();

  if (orderErr || !order) {
    // Concurrent same-idempotency-key request — try to fetch
    const { data: maybeDup } = await supabase
      .from('orders')
      .select('id, public_code, status, total, payment_method, payment_status')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();
    if (maybeDup) {
      return NextResponse.json({ order: maybeDup, idempotent_replay: true });
    }
    return NextResponse.json({ error: 'order_create_failed', detail: orderErr?.message }, { status: 500 });
  }

  const itemsWithOrder = itemRows.map((row) => ({ ...row, order_id: order.id }));
  const { error: itemsErr } = await supabase.from('order_items').insert(itemsWithOrder);

  if (itemsErr) {
    // Roll back the order we just created
    await supabase.from('orders').delete().eq('id', order.id);
    return NextResponse.json({ error: 'order_items_failed', detail: itemsErr.message }, { status: 500 });
  }

  // Append-only event log
  await supabase.from('order_events').insert({
    order_id: order.id,
    event_type: 'order.placed',
    actor_id: userId,
    actor_role: 'customer',
    payload: {
      total,
      payment_method: payload.payment_method,
      items_count: payload.items.length,
      distance_km: km,
    },
  });

  // -----------------------------------------------------------------
  // 9. WRITE SOFT-ACCOUNT SESSION COOKIE
  // -----------------------------------------------------------------
  await writeSession({ userId, phone, name });

  // Notify the store owner of a new order — but only when it's immediately
  // actionable (cash → 'placed'). Online-payment orders ('pending_payment')
  // should buzz the store at payment-confirm time instead (not wired yet).
  if (orderStatus === 'placed') {
    const { data: storeRow } = await supabase
      .from('stores')
      .select('owner_id')
      .eq('id', storeId)
      .maybeSingle();
    if (storeRow?.owner_id) {
      await notifyUsers([storeRow.owner_id], {
        title: 'Фармоиши нав — Colibri',
        body: `Фармоиши нав ${order.public_code}. Тасдиқ кунед.`,
        data: { type: 'store_new_order', orderId: order.id, code: order.public_code },
        channelId: 'orders',
      });
    }
  }

  return NextResponse.json({ order, idempotent_replay: false });
}

async function generateUniquePublicCode(supabase: ReturnType<typeof getSupabaseAdmin>): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generatePublicCode();
    const { data: existing } = await supabase
      .from('orders')
      .select('id')
      .eq('public_code', code)
      .maybeSingle();
    if (!existing) return code;
  }
  // Extreme fallback: append timestamp
  return `${generatePublicCode()}${Date.now().toString(36).slice(-2).toUpperCase()}`;
}
