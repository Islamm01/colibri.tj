import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { readStaffSession } from '@/lib/staff/session';

export const dynamic = 'force-dynamic';

// GET /api/staff/admin/settlement/payouts?storeId=...
// Past payouts, newest first, optionally filtered by store. Admin only.
export async function GET(request: Request) {
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const storeId = new URL(request.url).searchParams.get('storeId');
  const supabase = getSupabaseAdmin();

  let query = supabase
    .from('payouts')
    .select('id, store_id, amount, order_count, status, reference, note, created_at, paid_at, store:store_id (name)')
    .order('created_at', { ascending: false })
    .limit(200);
  if (storeId) query = query.eq('store_id', storeId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'fetch_failed', detail: error.message }, { status: 500 });

  return NextResponse.json({ payouts: data ?? [] });
}
