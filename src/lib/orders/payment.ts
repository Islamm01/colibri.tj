import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { notifyUsers } from '@/lib/push/notify';

// =====================================================================
// Single source of truth for "this order's payment is in".
//
// Cash orders are created already in `placed` and the store is notified at
// checkout. Online orders (QR / bank transfer) are created in
// `pending_payment` and wait — they must NOT reach the store until the money
// is confirmed. This helper performs that release exactly once, from whichever
// path confirms the payment (staff verifies manually, or the bank webhook
// fires automatically), so both share one definition of "paid".
// =====================================================================

interface MarkPaidOptions {
  orderId: string;
  /** Extra columns to set on the order (e.g. payment_confirmed_by, payment_reference). */
  extraOrderFields?: Record<string, unknown>;
  /** The payment event to log (who confirmed, and how). */
  event: {
    type: string;
    actorRole: string;
    actorId?: string | null;
    payload?: Record<string, unknown>;
  };
}

interface MarkPaidResult {
  /** false if the order was missing or already paid (no-op). */
  ok: boolean;
  /** true when this call moved an online order into the store queue. */
  releasedToStore: boolean;
}

/**
 * Mark an order paid and, if it was an online order still waiting on payment,
 * release it into the store's queue (move to `placed` + notify the store —
 * the same buzz a cash order triggers at checkout). Idempotent: a second call
 * on an already-paid order does nothing.
 */
export async function markOrderPaid(opts: MarkPaidOptions): Promise<MarkPaidResult> {
  const supabase = getSupabaseAdmin();

  const { data: order } = await supabase
    .from('orders')
    .select('id, status, store_id, public_code, payment_method, payment_status')
    .eq('id', opts.orderId)
    .maybeSingle();

  if (!order) return { ok: false, releasedToStore: false };
  // Already settled — don't double-notify the store.
  if (order.payment_status === 'paid') return { ok: false, releasedToStore: false };

  // An online order that hasn't been placed yet should now enter the queue.
  const releaseToStore = order.status === 'pending_payment';

  await supabase
    .from('orders')
    .update({
      payment_status: 'paid',
      payment_confirmed_at: new Date().toISOString(),
      ...(releaseToStore ? { status: 'placed' } : {}),
      ...opts.extraOrderFields,
    })
    .eq('id', order.id);

  // Log the payment confirmation itself.
  await supabase.from('order_events').insert({
    order_id: order.id,
    event_type: opts.event.type,
    actor_id: opts.event.actorId ?? null,
    actor_role: opts.event.actorRole,
    payload: opts.event.payload ?? {},
  });

  if (releaseToStore) {
    // Mirror a cash order: log order.placed so the timeline matches, and buzz
    // the store owner that an actionable order just arrived.
    await supabase.from('order_events').insert({
      order_id: order.id,
      event_type: 'order.placed',
      actor_role: 'system',
      payload: { reason: 'payment_confirmed', payment_method: order.payment_method },
    });

    const { data: storeRow } = await supabase
      .from('stores')
      .select('owner_id')
      .eq('id', order.store_id)
      .maybeSingle();

    if (storeRow?.owner_id) {
      await notifyUsers([storeRow.owner_id], {
        title: 'Фармоиши нав — Colibri',
        body: `Фармоиши пардохтшуда ${order.public_code}. Тасдиқ кунед.`,
        data: { type: 'store_new_order', orderId: order.id, code: order.public_code },
        channelId: 'orders',
      });
    }
  }

  return { ok: true, releasedToStore: releaseToStore };
}
