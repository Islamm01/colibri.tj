import { NextResponse } from 'next/server';
import { reverseGeocode } from '@/lib/geo/geocoding';

export const dynamic = 'force-dynamic';

// GET /api/geo/reverse?lat=40.28&lng=69.62&locale=ru
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get('lat'));
  const lng = Number(searchParams.get('lng'));
  const locale = searchParams.get('locale') ?? 'ru';

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'invalid_coords' }, { status: 400 });
  }

  const address = await reverseGeocode(lat, lng, locale);
  return NextResponse.json({ address });
}
