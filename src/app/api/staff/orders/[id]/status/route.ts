import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { readStaffSession } from '@/lib/staff/session';
import type { OrderStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

// Valid status transitions and which timestamp to set
const TRANSITIONS: Record<string, { from: OrderStatus[]; timestampColumn: string | null; courierOnly?: boolean }> = {
  accepted: {
    from: ['placed'],
    timestampColumn: 'accepted_at',
  },
  preparing: {
    from: ['accepted'],
    timestampColumn: null,
  },
  ready: {
    from: ['accepted', 'preparing'],
    timestampColumn: 'ready_at',
  },
  picked_up: {
    from: ['courier_assigned'],
    timestampColumn: 'picked_up_at',
    courierOnly: true,
  },
  delivered: {
    from: ['picked_up'],
    timestampColumn: 'delivered_at',
    courierOnly: true,
  },
  cancelled: {
    from: ['placed', 'accepted', 'preparing', 'ready', 'pending_payment'],
    timestampColumn: 'cancelled_at',
  },
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  let body: { status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const nextStatus = body.status;
  if (!nextStatus || !(nextStatus in TRANSITIONS)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Load order with relevant fields for auth + post-update side effects
  const { data: order } = await supabase
    .from('orders')
    .select('id, store_id, status, courier_id')
    .eq('id', id)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Authorization by role
  const rule = TRANSITIONS[nextStatus];
  if (rule.courierOnly) {
    if (session.role !== 'courier') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    if (order.courier_id !== session.userId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  } else if (session.role === 'store_owner') {
    if (order.store_id !== session.storeId) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
  } else if (session.role === 'courier') {
    // Couriers can only do courier-only transitions
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  // operator and admin can do anything

  // Transition validation
  if (!rule.from.includes(order.status as OrderStatus)) {
    return NextResponse.json({
      error: 'invalid_transition',
      from: order.status,
      to: nextStatus,
    }, { status: 400 });
  }

  // Apply the transition
  const updates: Record<string, unknown> = { status: nextStatus };
  if (rule.timestampColumn) {
    updates[rule.timestampColumn] = new Date().toISOString();
  }

  const { data: updated, error: updateErr } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', id)
    .select('id, status')
    .single();

  if (updateErr || !updated) {
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }

  // Append event log
  await supabase.from('order_events').insert({
    order_id: id,
    event_type: `order.${nextStatus}`,
    actor_id: session.userId,
    actor_role: session.role,
    payload: { from: order.status, to: nextStatus },
  });

  // Side effects per transition:
  // - ready → kick the dispatcher
  // - delivered → free the courier so they can take another offer
  // - cancelled (with assigned courier) → free the courier too
  if (nextStatus === 'ready') {
    try {
      const { dispatchNextOffer } = await import('@/lib/dispatch/dispatcher');
      await dispatchNextOffer(id);
    } catch (err) {
      console.error('[colibri] dispatch error', err);
      // Don't fail the status transition; operator can manually dispatch.
    }
  }

  if (nextStatus === 'delivered' || (nextStatus === 'cancelled' && order.courier_id)) {
    await supabase
      .from('couriers')
      .update({ status: 'online', current_order_id: null })
      .eq('user_id', order.courier_id);

    if (nextStatus === 'delivered') {
      // Increment total_deliveries
      const { data: courierRow } = await supabase
        .from('couriers')
        .select('total_deliveries')
        .eq('user_id', order.courier_id)
        .maybeSingle();
      if (courierRow) {
        await supabase
          .from('couriers')
          .update({ total_deliveries: (courierRow.total_deliveries ?? 0) + 1 })
          .eq('user_id', order.courier_id);
      }
    }
  }

  return NextResponse.json({ ok: true, order: updated });
}
