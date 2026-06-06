import { NextResponse } from 'next/server';
import { getSupabaseServer, isSupabaseConfigured } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// GET /api/stores/[storeId]/reviews — public list of published reviews
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ storeId: string }> },
) {
  const { storeId } = await params;
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ reviews: [], summary: { rating: 0, count: 0, breakdown: {} } });
  }
  try {
    const supabase = await getSupabaseServer();
    const { data: reviews } = await supabase
      .from('store_reviews')
      .select('id, rating, comment, customer_name, created_at')
      .eq('store_id', storeId)
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(50);

    const list = reviews ?? [];
    const count = list.length;
    const avg = count > 0 ? list.reduce((s, r) => s + r.rating, 0) / count : 0;
    const breakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of list) breakdown[r.rating] = (breakdown[r.rating] ?? 0) + 1;

    return NextResponse.json({
      reviews: list,
      summary: { rating: Math.round(avg * 10) / 10, count, breakdown },
    });
  } catch {
    return NextResponse.json({ reviews: [], summary: { rating: 0, count: 0, breakdown: {} } });
  }
}
