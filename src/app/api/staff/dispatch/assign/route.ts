import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { readStaffSession } from '@/lib/staff/session';
import { sendExpoPush } from '@/lib/push/expo';

export const dynamic = 'force-dynamic';

// GET — list couriers (online first) so the operator can pick one to assign.
export async function GET() {
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'operator' && session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data: couriers } = await supabase
    .from('couriers')
    .select('user_id, status, current_order_id, last_ping_at, user:user_id (name, phone)')
    .order('status', { ascending: true });

  const shaped = (couriers ?? []).map((c) => {
    const u = Array.isArray(c.user) ? c.user[0] : c.user;
    return {
      userId: c.user_id,
      name: u?.name ?? 'Курьер',
      phone: u?.phone ?? '',
      status: c.status,
      busy: !!c.current_order_id,
    };
  });

  return NextResponse.json({ couriers: shaped });
}

// POST — manually assign a courier to an order, bypassing the offer flow.
export async function POST(request: Request) {
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'operator' && session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.orderId || !body?.courierId) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Verify order exists and isn't already delivered/cancelled
  const { data: order } = await supabase
    .from('orders')
    .select('id, status, courier_id, public_code')
    .eq('id', body.orderId)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: 'order_not_found' }, { status: 404 });
  if (['delivered', 'cancelled'].includes(order.status)) {
    return NextResponse.json({ error: 'order_closed' }, { status: 400 });
  }

  // Verify courier isn't busy with another order
  const { data: courier } = await supabase
    .from('couriers')
    .select('user_id, current_order_id')
    .eq('user_id', body.courierId)
    .maybeSingle();
  if (!courier) return NextResponse.json({ error: 'courier_not_found' }, { status: 404 });
  if (courier.current_order_id && courier.current_order_id !== body.orderId) {
    return NextResponse.json({ error: 'courier_busy' }, { status: 409 });
  }

  // Assign — set the order's courier and move it to courier_assigned
  await supabase
    .from('orders')
    .update({ courier_id: body.courierId, status: 'courier_assigned' })
    .eq('id', body.orderId);

  // Lock the courier
  await supabase
    .from('couriers')
    .update({ status: 'on_delivery', current_order_id: body.orderId })
    .eq('user_id', body.courierId);

  // Cancel any outstanding pending offers for this order
  await supabase
    .from('delivery_offers')
    .update({ status: 'rejected', responded_at: new Date().toISOString() })
    .eq('order_id', body.orderId)
    .eq('status', 'pending');

  // Audit
  await supabase.from('order_events').insert({
    order_id: body.orderId,
    event_type: 'dispatch.manual_assign',
    actor_id: session.userId,
    actor_role: session.role,
    payload: { courier_id: body.courierId },
  });

  // Native push — the whole reason the app exists. Best-effort: a failed
  // push must never undo a successful assignment, so we look up the token,
  // fire, and ignore the result. (Slice 1 wires push at this manual-assign
  // point; the auto-offer path gets the same call in a later slice.)
  const { data: courierUser } = await supabase
    .from('users')
    .select('expo_push_token')
    .eq('id', body.courierId)
    .maybeSingle();

  if (courierUser?.expo_push_token) {
    const code = order.public_code ?? '';
    await sendExpoPush([courierUser.expo_push_token], {
      title: 'Нав фармоиш — Colibri',
      body: code ? `Ба шумо фармоиши ${code} таъин шуд` : 'Ба шумо фармоиши нав таъин шуд',
      data: { type: 'order_assigned', orderId: body.orderId, code: order.public_code ?? null },
      channelId: 'orders',
    });
  }

  return NextResponse.json({ ok: true });
}
