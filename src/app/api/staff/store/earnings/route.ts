import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { readStaffSession } from '@/lib/staff/session';
import { getStoreOutstanding, getStoreLifetime, getStoreRecentOrders } from '@/lib/settlement/queries';

export const dynamic = 'force-dynamic';

// GET /api/staff/store/earnings
// A store owner's own earnings: current outstanding balance, payout history,
// and recent orders with per-order earning. STRICTLY scoped to the store on
// the signed session — the store id is never taken from the request, so a
// store owner can only ever see their own books.
export async function GET() {
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'store_owner' || !session.storeId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const storeId = session.storeId; // object-level scope — from the cookie, not the client
  const supabase = getSupabaseAdmin();

  const [outstanding, lifetime, recent, { data: payouts }] = await Promise.all([
    getStoreOutstanding(supabase, storeId),
    getStoreLifetime(supabase, storeId),
    getStoreRecentOrders(supabase, storeId, 20),
    supabase
      .from('payouts')
      .select('id, amount, order_count, status, reference, created_at, paid_at')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  return NextResponse.json({
    outstanding,
    lifetime,
    recent,
    payouts: payouts ?? [],
  });
}
