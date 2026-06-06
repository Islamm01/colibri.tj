import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { readStaffSession } from '@/lib/staff/session';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const url = new URL(request.url);
  const includeCompleted = url.searchParams.get('completed') === '1';

  const supabase = getSupabaseAdmin();

  let query = supabase
    .from('orders')
    .select(`
      id, public_code, status, customer_name, customer_phone,
      subtotal, delivery_fee, total, payment_method, payment_status,
      notes, prep_eta_minutes, delivery_eta_minutes,
      created_at, accepted_at, ready_at, picked_up_at, delivered_at,
      store_id, courier_id, vertical,
      address:address_id (formatted_address, details),
      items:order_items (id, name_snapshot, price_snapshot, unit_snapshot, quantity, subtotal),
      store:store_id (id, name)
    `)
    .order('created_at', { ascending: false });

  // Store owner sees only their store
  if (session.role === 'store_owner') {
    if (!session.storeId) {
      return NextResponse.json({ orders: [] });
    }
    query = query.eq('store_id', session.storeId);
  } else if (session.role === 'courier') {
    query = query.eq('courier_id', session.userId);
  }
  // Operator/admin see all

  if (!includeCompleted) {
    query = query.not('status', 'in', '("delivered","cancelled")');
  } else {
    // Show last 7 days for completed view
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    query = query.gte('created_at', weekAgo);
  }

  const { data: orders, error } = await query.limit(100);

  if (error) {
    return NextResponse.json({ error: 'fetch_failed', detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ orders: orders ?? [] });
}
