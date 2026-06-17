import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// GET /api/price-index/history?days=30
// Returns a time series of the bazaar "market index" (average of each item's
// bazaar mid-price per day) plus per-item series, for a trading-style chart.
export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ days: [], overall: [], items: {} });
  }

  const url = new URL(request.url);
  const daysParam = Number(url.searchParams.get('days'));
  const windowDays = Number.isFinite(daysParam) && daysParam > 0 ? Math.min(daysParam, 90) : 30;

  const since = new Date();
  since.setDate(since.getDate() - (windowDays - 1));
  const sinceStr = since.toISOString().slice(0, 10);

  try {
    // Service-role read: published price data is public and this runs
    // server-side, so it stays correct regardless of RLS (see migration 0022).
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('price_index')
      .select('item_key, effective_date, bazaar_low, bazaar_high')
      .eq('is_published', true)
      .gte('effective_date', sinceStr)
      .order('effective_date', { ascending: true });

    if (error) {
      console.error('[price-index/history] load failed', error.message);
      return NextResponse.json({ days: [], overall: [], items: {} });
    }

    const rows = data ?? [];

    // Sorted unique dates present in the window
    const dateSet = new Set<string>();
    for (const r of rows) dateSet.add(r.effective_date);
    const days = [...dateSet].sort();
    const dayIndex = new Map(days.map((d, i) => [d, i]));

    const mid = (lo: number | null, hi: number | null) => {
      if (lo != null && hi != null) return (Number(lo) + Number(hi)) / 2;
      if (lo != null) return Number(lo);
      if (hi != null) return Number(hi);
      return null;
    };

    // Per-item series aligned to `days`
    const items: Record<string, (number | null)[]> = {};
    for (const r of rows) {
      const i = dayIndex.get(r.effective_date);
      if (i == null) continue;
      if (!items[r.item_key]) items[r.item_key] = new Array(days.length).fill(null);
      items[r.item_key][i] = mid(r.bazaar_low, r.bazaar_high);
    }

    // Overall market index = average across items that have a value that day
    const overall: (number | null)[] = days.map((_, i) => {
      let sum = 0;
      let n = 0;
      for (const key of Object.keys(items)) {
        const v = items[key][i];
        if (v != null) {
          sum += v;
          n += 1;
        }
      }
      return n > 0 ? Math.round((sum / n) * 100) / 100 : null;
    });

    return NextResponse.json({ days, overall, items });
  } catch {
    return NextResponse.json({ days: [], overall: [], items: {} });
  }
}
