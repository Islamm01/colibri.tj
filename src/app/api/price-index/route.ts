import { NextResponse } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export interface PriceRow {
  id: string;
  item_key: string;
  name_tj: string;
  name_ru: string;
  unit: string;
  category: string;
  emoji: string | null;
  farm_low: number | null;
  farm_high: number | null;
  bazaar_low: number | null;
  bazaar_high: number | null;
  trend: 'up' | 'down' | 'flat';
  region: string | null;
  effective_date: string;
}

// GET /api/price-index — returns the most recent published prices
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ prices: [], date: null });
  }

  try {
    // Read with the service-role client. This route only ever exposes
    // published price rows (intended public data) and runs server-side, so it
    // is safe — and it stays correct regardless of the table's RLS state.
    // (The anon client previously returned zero rows here whenever RLS was
    // enabled without a public-read policy — see migration 0022.)
    const supabase = getSupabaseAdmin();

    // Pull all published rows, newest first, then keep the most recent row per
    // item. This shows every product's latest known price even if some weren't
    // re-priced today — more robust than showing a single (possibly partial) day.
    const { data, error } = await supabase
      .from('price_index')
      .select('*')
      .eq('is_published', true)
      .order('effective_date', { ascending: false });

    if (error) {
      console.error('[price-index] load failed', error.message);
      return NextResponse.json({ prices: [], date: null });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ prices: [], date: null });
    }

    const seen = new Set<string>();
    const prices: typeof data = [];
    let latestDate: string | null = null;
    for (const row of data) {
      if (!latestDate) latestDate = row.effective_date;
      if (seen.has(row.item_key)) continue;
      seen.add(row.item_key);
      prices.push(row);
    }
    prices.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

    return NextResponse.json({ prices, date: latestDate });
  } catch {
    return NextResponse.json({ prices: [], date: null });
  }
}
