import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/**
 * Customer taps "I've paid" after QR/transfer. This does NOT mark the order
 * paid — it moves payment to 'awaiting_confirmation' so an operator (or, later,
 * a bank webhook) verifies the money actually arrived. Optionally records a
 * customer-entered transaction reference.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  if (!code || !/^COL-[A-Z2-9]{4}$/i.test(code)) {
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const reference = typeof body.reference === 'string' ? body.reference.slice(0, 64) : null;

  const supabase = getSupabaseAdmin();
  const { data: order } = await supabase
    .from('orders')
    .select('id, status, payment_status, payment_method')
    .eq('public_code', code.toUpperCase())
    .maybeSingle();

  if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (order.payment_method === 'cash') {
    return NextResponse.json({ error: 'cash_does_not_need_confirmation' }, { status: 400 });
  }
  if (order.payment_status === 'paid') {
    return NextResponse.json({ ok: true, already_paid: true });
  }

  const { error: updateErr } = await supabase
    .from('orders')
    .update({
      payment_status: 'awaiting_confirmation',
      payment_claimed_at: new Date().toISOString(),
      payment_reference: reference,
    })
    .eq('id', order.id);

  if (updateErr) {
    return NextResponse.json({ error: 'update_failed', detail: updateErr.message }, { status: 500 });
  }

  await supabase.from('order_events').insert({
    order_id: order.id,
    event_type: 'payment.claimed_by_customer',
    actor_role: 'customer',
    payload: { method: order.payment_method, reference },
  });

  return NextResponse.json({ ok: true, status: 'awaiting_confirmation' });
}
