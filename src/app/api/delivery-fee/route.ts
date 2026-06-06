import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { isValidLatLng } from '@/lib/validation';
import { distanceKm, calculateDeliveryFee } from '@/lib/orders/pricing';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const storeId = searchParams.get('storeId');
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lng = parseFloat(searchParams.get('lng') ?? '');
  const subtotal = parseFloat(searchParams.get('subtotal') ?? '0');

  if (!storeId) {
    return NextResponse.json({ error: 'missing_store_id' }, { status: 400 });
  }

  const coords = isValidLatLng(lat, lng);
  if (!coords) {
    return NextResponse.json({ error: 'invalid_coords' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: store } = await supabase
    .from('stores')
    .select('lat, lng')
    .eq('id', storeId)
    .eq('is_active', true)
    .maybeSingle();

  if (!store) {
    return NextResponse.json({ error: 'store_not_found' }, { status: 404 });
  }

  const { data: zone } = await supabase
    .from('delivery_zones')
    .select('base_fee, included_km, per_km_rate, free_delivery_threshold')
    .eq('active', true)
    .limit(1)
    .maybeSingle();

  const km = distanceKm(store.lat, store.lng, coords.lat, coords.lng);
  const breakdown = calculateDeliveryFee({
    subtotal,
    distanceKm: km,
    baseFee: zone ? Number(zone.base_fee) : 15,
    includedKm: zone ? Number(zone.included_km) : 2,
    perKmRate: zone ? Number(zone.per_km_rate) : 3,
    freeDeliveryThreshold: zone?.free_delivery_threshold ? Number(zone.free_delivery_threshold) : null,
  });

  return NextResponse.json({ fee: breakdown.fee, free: breakdown.free, distanceKm: km });
}
