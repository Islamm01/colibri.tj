import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { readStaffSession } from '@/lib/staff/session';

export const dynamic = 'force-dynamic';

// GET — orders currently in the dispatch pipeline + their offer states.
export async function GET() {
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!['operator', 'admin'].includes(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();

  // Orders that are ready/assigned but not yet picked up — the active dispatch window
  const { data: orders } = await supabase
    .from('orders')
    .select('id, public_code, status, vertical, courier_id, created_at, dispatch_attempts')
    .in('status', ['ready', 'courier_assigned'])
    .order('created_at', { ascending: true })
    .limit(40);

  const list = orders ?? [];
  if (list.length === 0) return NextResponse.json({ orders: [] });

  // Pull all offers for these orders
  const orderIds = list.map((o) => o.id);
  const { data: offers } = await supabase
    .from('delivery_offers')
    .select('id, order_id, courier_id, status, created_at, distance_km')
    .in('order_id', orderIds);

  // Names for couriers referenced
  const courierIds = Array.from(new Set((offers ?? []).map((o) => o.courier_id).concat(list.map((o) => o.courier_id).filter(Boolean) as string[])));
  let nameMap: Record<string, string> = {};
  if (courierIds.length > 0) {
    const { data: users } = await supabase.from('users').select('id, name').in('id', courierIds);
    nameMap = Object.fromEntries((users ?? []).map((u) => [u.id, u.name]));
  }

  const offersByOrder: Record<string, { courier: string; status: string; distanceKm: number | null }[]> = {};
  for (const o of offers ?? []) {
    (offersByOrder[o.order_id] ??= []).push({
      courier: nameMap[o.courier_id] || 'Курьер',
      status: o.status,
      distanceKm: o.distance_km,
    });
  }

  const result = list.map((o) => ({
    id: o.id,
    publicCode: o.public_code,
    status: o.status,
    vertical: o.vertical,
    assignedCourier: o.courier_id ? nameMap[o.courier_id] || 'Курьер' : null,
    attempts: o.dispatch_attempts ?? 0,
    waitingSeconds: Math.round((Date.now() - new Date(o.created_at).getTime()) / 1000),
    offers: offersByOrder[o.id] ?? [],
  }));

  return NextResponse.json({ orders: result });
}
