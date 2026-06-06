import { NextResponse } from 'next/server';
import { searchAddresses } from '@/lib/geo/geocoding';

export const dynamic = 'force-dynamic';

// GET /api/geo/search?q=Ленина&locale=ru
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q') ?? '';
  const locale = searchParams.get('locale') ?? 'ru';

  if (q.trim().length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const suggestions = await searchAddresses(q, locale);
  return NextResponse.json({ suggestions });
}
