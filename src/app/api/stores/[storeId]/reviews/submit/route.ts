import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { readSession } from '@/lib/session/server';

export const dynamic = 'force-dynamic';

// POST /api/stores/[storeId]/reviews — submit a review.
// Requires a soft-account session AND a delivered order from this store.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await params;
  const session = await readSession();
  if (!session) return NextResponse.json({ error: 'not_signed_in' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const rating = Number(body?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'invalid_rating' }, { status: 400 });
  }
  const comment = typeof body?.comment === 'string' ? body.comment.trim().slice(0, 500) : null;

  const supabase = getSupabaseAdmin();

  // Find a delivered order from this store by this customer that isn't reviewed yet
  const { data: order } = await supabase
    .from('orders')
    .select('id, status')
    .eq('store_id', storeId)
    .eq('customer_user_id', session.userId)
    .eq('status', 'delivered')
    .order('delivered_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: 'no_delivered_order' }, { status: 403 });
  }

  // Already reviewed this order?
  const { data: existing } = await supabase
    .from('store_reviews')
    .select('id')
    .eq('order_id', order.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: 'already_reviewed' }, { status: 409 });
  }

  const { error } = await supabase.from('store_reviews').insert({
    store_id: storeId,
    order_id: order.id,
    customer_user_id: session.userId,
    customer_name: session.name,
    rating,
    comment: comment || null,
  });
  if (error) {
    return NextResponse.json({ error: 'save_failed', detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
