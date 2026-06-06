import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  if (!code || !/^COL-[A-Z2-9]{4}$/i.test(code)) {
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: order } = await supabase
    .from('orders')
    .select(`
      id, public_code, status, courier_id, vertical,
      customer_name, customer_phone,
      subtotal, delivery_fee, total,
      payment_method, payment_status, notes,
      prep_eta_minutes, delivery_eta_minutes,
      parcel_details, cash_payer,
      created_at, accepted_at, ready_at, picked_up_at, delivered_at, cancelled_at,
      store:store_id (id, name, slug, address, lat, lng),
      address:address_id (formatted_address, details, lat, lng),
      pickup_address:pickup_address_id (formatted_address, details, lat, lng),
      items:order_items (id, name_snapshot, price_snapshot, unit_snapshot, quantity, subtotal)
    `)
    .eq('public_code', code.toUpperCase())
    .maybeSingle();

  if (!order) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({ order });
}
