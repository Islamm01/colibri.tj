import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { readStaffSession } from '@/lib/staff/session';
import { markOrderPaid } from '@/lib/orders/payment';

export const dynamic = 'force-dynamic';

/**
 * Staff confirms (or rejects) that a non-cash payment actually arrived.
 * Body: { orderId, decision: 'confirm' | 'reject' }
 *
 * This is the same state transition a real bank webhook will perform once
 * automated — see /api/payments/webhook. Keeping the logic here means manual
 * and automatic confirmation share one definition of "paid".
 */
export async function POST(request: Request) {
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!['operator', 'admin', 'store_owner'].includes(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.orderId || !['confirm', 'reject'].includes(body.decision)) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: order } = await supabase
    .from('orders')
    .select('id, payment_status, payment_method')
    .eq('id', body.orderId)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (body.decision === 'confirm') {
    // Mark paid AND, for an online order still waiting on payment, release it
    // into the store queue (move to `placed` + notify the store). Shared with
    // the bank webhook so manual and automatic confirmation behave identically.
    const result = await markOrderPaid({
      orderId: order.id,
      extraOrderFields: { payment_confirmed_by: session.userId },
      event: {
        type: 'payment.confirmed_by_staff',
        actorRole: session.role,
        actorId: session.userId,
        payload: { method: order.payment_method },
      },
    });
    return NextResponse.json({
      ok: true,
      payment_status: 'paid',
      released_to_store: result.releasedToStore,
    });
  }

  // reject -> back to pending so the customer can retry
  await supabase
    .from('orders')
    .update({ payment_status: 'pending', payment_claimed_at: null })
    .eq('id', order.id);

  await supabase.from('order_events').insert({
    order_id: order.id,
    event_type: 'payment.rejected_by_staff',
    actor_id: session.userId,
    actor_role: session.role,
  });
  return NextResponse.json({ ok: true, payment_status: 'pending' });
}
