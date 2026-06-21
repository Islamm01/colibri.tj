import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { readStaffSession } from '@/lib/staff/session';
import { getStoreOutstanding, getStoreLifetime } from '@/lib/settlement/queries';

export const dynamic = 'force-dynamic';

// GET /api/staff/admin/settlement/[storeId]
// Drill-in for one store: outstanding balance + the orders behind it, plus
// lifetime paid-out and commission-earned totals. Admin only. Read-only.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { storeId } = await params;
  const supabase = getSupabaseAdmin();

  const { data: store } = await supabase
    .from('stores')
    .select('id, name')
    .eq('id', storeId)
    .maybeSingle();
  if (!store) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const [outstanding, lifetime] = await Promise.all([
    getStoreOutstanding(supabase, storeId),
    getStoreLifetime(supabase, storeId),
  ]);

  return NextResponse.json({ store, outstanding, lifetime });
}
