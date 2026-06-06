import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { readStaffSession } from '@/lib/staff/session';

export const dynamic = 'force-dynamic';

export async function POST() {
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'courier') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supabase = getSupabaseAdmin();

  // Refuse to go offline if courier has an active delivery
  const { data: courier } = await supabase
    .from('couriers')
    .select('current_order_id')
    .eq('user_id', session.userId)
    .maybeSingle();
  if (courier?.current_order_id) {
    return NextResponse.json({ error: 'has_active_delivery' }, { status: 400 });
  }

  // Expire any pending offers for this courier — we don't want to leave dangling offers
  const { data: pendingOffers } = await supabase
    .from('delivery_offers')
    .select('id, order_id')
    .eq('courier_id', session.userId)
    .eq('status', 'pending');

  if (pendingOffers && pendingOffers.length > 0) {
    await supabase
      .from('delivery_offers')
      .update({ status: 'rejected', responded_at: new Date().toISOString() })
      .in('id', pendingOffers.map((o) => o.id));

    // Kick dispatcher for each affected order
    const { dispatchNextOffer } = await import('@/lib/dispatch/dispatcher');
    for (const o of pendingOffers) {
      await dispatchNextOffer(o.order_id);
    }
  }

  await supabase
    .from('couriers')
    .update({ status: 'offline' })
    .eq('user_id', session.userId);

  return NextResponse.json({ ok: true });
}
