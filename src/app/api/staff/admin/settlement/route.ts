import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { readStaffSession } from '@/lib/staff/session';
import { getSettlementOverview } from '@/lib/settlement/queries';

export const dynamic = 'force-dynamic';

// GET /api/staff/admin/settlement
// "What do we owe everyone right now" — one row per store with the current
// outstanding balance and last payout. Admin only. Read-only.
export async function GET() {
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const data = await getSettlementOverview(supabase);
  return NextResponse.json(data);
}

// POST /api/staff/admin/settlement
// Record a payout to a store: atomically sums the store's unsettled settleable
// orders, creates a 'paid' payout row, and marks those orders settled — via the
// record_store_payout() RPC (transactional, never double-settles). Admin only.
// Records that Colibri paid the store; does NOT move real money.
// TODO: future — automated payouts via provider.
export async function POST(request: Request) {
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body?.storeId) return NextResponse.json({ error: 'missing_store' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('record_store_payout', {
    p_store_id: body.storeId,
    p_created_by: session.userId,
    p_reference: typeof body.reference === 'string' && body.reference.trim() ? body.reference.trim() : null,
    p_note: typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null,
    p_period_start: body.period_start || null,
    p_period_end: body.period_end || null,
  });

  if (error) {
    return NextResponse.json({ error: 'payout_failed', detail: error.message }, { status: 500 });
  }
  // The RPC returns NULL when there was nothing unsettled to pay (idempotent
  // no-op — e.g. a double click or an already-cleared balance).
  if (!data) {
    return NextResponse.json({ ok: true, settled: false, payout: null });
  }
  return NextResponse.json({ ok: true, settled: true, payout: data });
}
