import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { readStaffSession } from '@/lib/staff/session';
import { getCourierCashOverview } from '@/lib/settlement/queries';

export const dynamic = 'force-dynamic';

// GET /api/staff/admin/cash
// Per-courier COD cash collected (owed to Colibri) + recent deposit history.
// Admin only. Read-only. Separate ledger from store payouts.
export async function GET() {
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const supabase = getSupabaseAdmin();
  const data = await getCourierCashOverview(supabase);
  return NextResponse.json(data);
}

// POST /api/staff/admin/cash
// Record that a courier handed over their collected cash: atomically sums and
// marks their unreconciled delivered cash orders via record_courier_cash_deposit().
// Admin only. A record, not automated banking.
// TODO: future — courier cash deposit tracking detail (partial/short deposits).
export async function POST(request: Request) {
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body?.courierId) return NextResponse.json({ error: 'missing_courier' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc('record_courier_cash_deposit', {
    p_courier_id: body.courierId,
    p_created_by: session.userId,
    p_reference: typeof body.reference === 'string' && body.reference.trim() ? body.reference.trim() : null,
    p_note: typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null,
  });

  if (error) {
    return NextResponse.json({ error: 'reconcile_failed', detail: error.message }, { status: 500 });
  }
  // RPC returns NULL when there was nothing to reconcile (idempotent no-op).
  if (!data) {
    return NextResponse.json({ ok: true, reconciled: false, deposit: null });
  }
  return NextResponse.json({ ok: true, reconciled: true, deposit: data });
}
