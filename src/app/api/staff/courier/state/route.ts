import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { readStaffSession } from '@/lib/staff/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'courier') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supabase = getSupabaseAdmin();

  // Get courier row
  const { data: courier } = await supabase
    .from('couriers')
    .select('status, current_order_id, last_lat, last_lng, last_ping_at')
    .eq('user_id', session.userId)
    .maybeSingle();

  // Get active offer (pending) — clean expired ones on read
  const now = new Date().toISOString();
  await supabase
    .from('delivery_offers')
    .update({ status: 'expired', responded_at: now })
    .eq('courier_id', session.userId)
    .eq('status', 'pending')
    .lt('expires_at', now);

  const { data: offer } = await supabase
    .from('delivery_offers')
    .select(`
      id, order_id, expires_at, distance_km,
      order:order_id (
        public_code, customer_name, customer_phone, total, payment_method, notes,
        subtotal, delivery_fee, courier_earning, vertical, parcel_details, cash_payer,
        store:store_id (name, address, lat, lng),
        address:address_id (formatted_address, details, lat, lng),
        pickup_address:pickup_address_id (formatted_address, details, lat, lng),
        items:order_items (name_snapshot, quantity, unit_snapshot)
      )
    `)
    .eq('courier_id', session.userId)
    .eq('status', 'pending')
    .gt('expires_at', now)
    .maybeSingle();

  // Get active delivery (assigned to this courier, not yet delivered)
  let activeOrder = null;
  if (courier?.current_order_id) {
    const { data: order } = await supabase
      .from('orders')
      .select(`
        id, public_code, status, customer_name, customer_phone, total, payment_method, notes,
        vertical, parcel_details, cash_payer,
        store:store_id (name, address, lat, lng),
        address:address_id (formatted_address, details, lat, lng),
        pickup_address:pickup_address_id (formatted_address, details, lat, lng),
        items:order_items (name_snapshot, quantity, unit_snapshot)
      `)
      .eq('id', courier.current_order_id)
      .maybeSingle();
    if (order && order.status !== 'delivered' && order.status !== 'cancelled') {
      activeOrder = order;
    }
  }

  // Recent delivered orders by this courier — the "history" that should
  // persist after each delivery (was disappearing because only the active
  // order was ever returned).
  const { data: history } = await supabase
    .from('orders')
    .select('id, public_code, status, total, delivery_fee, courier_earning, vertical, delivered_at, customer_name')
    .eq('courier_id', session.userId)
    .in('status', ['delivered'])
    .order('delivered_at', { ascending: false })
    .limit(30);

  return NextResponse.json({
    courier: {
      status: courier?.status ?? 'offline',
      lastLat: courier?.last_lat,
      lastLng: courier?.last_lng,
    },
    offer: offer
      ? {
          id: offer.id,
          orderId: offer.order_id,
          expiresAt: offer.expires_at,
          distanceKm: offer.distance_km,
          order: Array.isArray(offer.order) ? offer.order[0] : offer.order,
        }
      : null,
    activeOrder,
    history: history ?? [],
  });
}
