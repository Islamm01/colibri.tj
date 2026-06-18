import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { writeSession } from '@/lib/session/server';
import { normalizePhone, isValidName, isValidLatLng } from '@/lib/validation';
import { generatePublicCode } from '@/lib/orders/pricing';
import { quoteParcel, validateParcelDistance, type ParcelWeightBand } from '@/lib/orders/parcel-pricing';
import { courierEarning, getCourierCommissionRate } from '@/lib/orders/courier-pay';
import type { PaymentMethod } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface ParcelAddressInput {
  formatted_address: string;
  details?: string;
  lat: number;
  lng: number;
  name: string;
  phone: string;
}

interface ParcelCheckoutPayload {
  idempotency_key: string;
  pickup: ParcelAddressInput;
  dropoff: ParcelAddressInput;
  contents_category: 'documents' | 'small' | 'medium' | 'large';
  contents_description?: string;
  weight: ParcelWeightBand;
  payment_method: PaymentMethod;
  cash_payer?: 'sender' | 'recipient';
  notes?: string;
}

const CATEGORIES: ParcelCheckoutPayload['contents_category'][] = [
  'documents',
  'small',
  'medium',
  'large',
];
const WEIGHTS: ParcelWeightBand[] = ['light', 'heavy'];
const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'qr', 'bank_transfer'];

export async function POST(request: Request) {
  try {
    return await handleParcelOrder(request);
  } catch (err) {
    // Any unexpected throw (e.g. Supabase not configured, network) becomes a
    // readable JSON error instead of an opaque 500 the form can't explain.
    const detail = err instanceof Error ? err.message : 'unknown_error';
    console.error('[colibri] parcel order fatal', err);
    return NextResponse.json({ error: 'order_create_failed', detail }, { status: 500 });
  }
}

async function handleParcelOrder(request: Request) {
  let payload: ParcelCheckoutPayload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  // ---------- Validate ----------
  if (!payload.idempotency_key || !/^[0-9a-f-]{36}$/i.test(payload.idempotency_key)) {
    return NextResponse.json({ error: 'invalid_idempotency_key' }, { status: 400 });
  }

  // Pickup
  const pickupPhone = normalizePhone(payload.pickup?.phone ?? '');
  if (!pickupPhone) return NextResponse.json({ error: 'invalid_pickup_phone' }, { status: 400 });
  if (!isValidName(payload.pickup?.name)) return NextResponse.json({ error: 'invalid_pickup_name' }, { status: 400 });
  const pickupCoords = isValidLatLng(payload.pickup?.lat, payload.pickup?.lng);
  if (!pickupCoords) return NextResponse.json({ error: 'invalid_pickup_location' }, { status: 400 });
  if (!payload.pickup.formatted_address?.trim()) {
    return NextResponse.json({ error: 'invalid_pickup_address' }, { status: 400 });
  }

  // Dropoff
  const dropoffPhone = normalizePhone(payload.dropoff?.phone ?? '');
  if (!dropoffPhone) return NextResponse.json({ error: 'invalid_dropoff_phone' }, { status: 400 });
  if (!isValidName(payload.dropoff?.name)) return NextResponse.json({ error: 'invalid_dropoff_name' }, { status: 400 });
  const dropoffCoords = isValidLatLng(payload.dropoff?.lat, payload.dropoff?.lng);
  if (!dropoffCoords) return NextResponse.json({ error: 'invalid_dropoff_location' }, { status: 400 });
  if (!payload.dropoff.formatted_address?.trim()) {
    return NextResponse.json({ error: 'invalid_dropoff_address' }, { status: 400 });
  }

  // Other fields
  if (!CATEGORIES.includes(payload.contents_category)) {
    return NextResponse.json({ error: 'invalid_category' }, { status: 400 });
  }
  if (!WEIGHTS.includes(payload.weight)) {
    return NextResponse.json({ error: 'invalid_weight' }, { status: 400 });
  }
  if (!PAYMENT_METHODS.includes(payload.payment_method)) {
    return NextResponse.json({ error: 'invalid_payment_method' }, { status: 400 });
  }

  // Cash payer only applies when payment_method is cash
  let cashPayer: 'sender' | 'recipient' | null = null;
  if (payload.payment_method === 'cash') {
    cashPayer = payload.cash_payer === 'recipient' ? 'recipient' : 'sender';
  }

  // ---------- Compute pricing ----------
  const quote = quoteParcel({
    pickupLat: pickupCoords.lat,
    pickupLng: pickupCoords.lng,
    dropoffLat: dropoffCoords.lat,
    dropoffLng: dropoffCoords.lng,
    weight: payload.weight,
  });

  const distanceCheck = validateParcelDistance(quote.distance_km);
  if (!distanceCheck.ok) {
    return NextResponse.json({ error: distanceCheck.reason }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // ---------- Idempotency replay ----------
  const { data: existing } = await supabase
    .from('orders')
    .select('id, public_code')
    .eq('idempotency_key', payload.idempotency_key)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({
      ok: true,
      order: { id: existing.id, public_code: existing.public_code },
    });
  }

  // ---------- Soft account: use the sender's phone as the customer ----------
  let user: { id: string } | null = null;
  const { data: foundUser } = await supabase
    .from('users')
    .select('id')
    .eq('phone', pickupPhone)
    .maybeSingle();

  if (foundUser) {
    user = foundUser;
  } else {
    const { data: newUser, error: userErr } = await supabase
      .from('users')
      .insert({
        phone: pickupPhone,
        name: payload.pickup.name.trim(),
        role: 'customer',
      })
      .select('id')
      .single();
    if (userErr) {
      return NextResponse.json({ error: 'user_create_failed', detail: userErr.message }, { status: 500 });
    }
    user = newUser;
  }

  // ---------- Create both addresses ----------
  const { data: pickupAddress, error: pickupErr } = await supabase
    .from('addresses')
    .insert({
      user_id: user!.id,
      formatted_address: payload.pickup.formatted_address.trim(),
      details: payload.pickup.details?.trim() || null,
      lat: pickupCoords.lat,
      lng: pickupCoords.lng,
    })
    .select('id')
    .single();
  if (pickupErr) {
    return NextResponse.json({ error: 'pickup_address_failed', detail: pickupErr.message }, { status: 500 });
  }

  const { data: dropoffAddress, error: dropoffErr } = await supabase
    .from('addresses')
    .insert({
      user_id: user!.id,
      formatted_address: payload.dropoff.formatted_address.trim(),
      details: payload.dropoff.details?.trim() || null,
      lat: dropoffCoords.lat,
      lng: dropoffCoords.lng,
    })
    .select('id')
    .single();
  if (dropoffErr) {
    return NextResponse.json({ error: 'dropoff_address_failed', detail: dropoffErr.message }, { status: 500 });
  }

  // ---------- Create the order ----------
  const publicCode = await generateUniquePublicCode(supabase);
  const courierRate = await getCourierCommissionRate(supabase);
  const parcelDetails = {
    contents_category: payload.contents_category,
    contents_description: payload.contents_description?.trim() || null,
    weight: payload.weight,
    pickup_name: payload.pickup.name.trim(),
    pickup_phone: pickupPhone,
    dropoff_name: payload.dropoff.name.trim(),
    dropoff_phone: dropoffPhone,
  };

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .insert({
      customer_user_id: user!.id,
      vertical: 'parcel',
      store_id: null,
      address_id: dropoffAddress.id,
      pickup_address_id: pickupAddress.id,
      parcel_details: parcelDetails,
      cash_payer: cashPayer,
      status: 'accepted', // auto-accepted; we go straight to dispatch
      payment_method: payload.payment_method,
      payment_status: payload.payment_method === 'cash' ? 'pending' : 'pending',
      subtotal: 0,
      delivery_fee: quote.total,
      courier_earning: courierEarning(quote.total, courierRate),
      total: quote.total,
      // For parcels, the "customer" name/phone in the orders table is the sender —
      // that's who placed the order. Couriers see both names via parcel_details.
      customer_name: payload.pickup.name.trim(),
      customer_phone: pickupPhone,
      notes: payload.notes?.trim() || null,
      public_code: publicCode,
      idempotency_key: payload.idempotency_key,
      accepted_at: new Date().toISOString(),
    })
    .select('id, public_code')
    .single();

  if (orderErr) {
    return NextResponse.json({
      error: 'order_create_failed',
      detail: orderErr.message,
    }, { status: 500 });
  }

  // ---------- Event log ----------
  await supabase.from('order_events').insert([
    {
      order_id: order.id,
      event_type: 'order.placed',
      actor_id: user!.id,
      actor_role: 'customer',
      payload: { vertical: 'parcel', total: quote.total },
    },
    {
      order_id: order.id,
      event_type: 'order.accepted',
      actor_role: 'operator',
      payload: { reason: 'auto_accepted_parcel' },
    },
  ]);

  // ---------- Kick the dispatcher ----------
  try {
    const { dispatchNextOffer } = await import('@/lib/dispatch/dispatcher');
    await dispatchNextOffer(order.id);
  } catch (err) {
    console.error('[colibri] parcel dispatch error', err);
    // Don't fail order creation; operator can manually dispatch.
  }

  // ---------- Write session cookie ----------
  await writeSession({ userId: user!.id, phone: pickupPhone, name: payload.pickup.name.trim() });

  return NextResponse.json({
    ok: true,
    order: { id: order.id, public_code: order.public_code },
  });
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
  return `${generatePublicCode()}${Date.now().toString(36).slice(-2).toUpperCase()}`;
}
