import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { readStaffSession } from '@/lib/staff/session';

export const dynamic = 'force-dynamic';

// GET /api/staff/price-index — returns the full catalog (latest row per
// item_key, regardless of date) so the editor shows a stable product list
// that never collapses to a single day after an edit.
export async function GET() {
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'operator' && session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('price_index')
    .select('*')
    .order('effective_date', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'load_failed', detail: error.message }, { status: 500 });
  }

  // Keep only the most recent row per item_key
  const seen = new Set<string>();
  const catalog: typeof data = [];
  for (const row of data ?? []) {
    if (seen.has(row.item_key)) continue;
    seen.add(row.item_key);
    catalog.push(row);
  }
  catalog.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  return NextResponse.json({ prices: catalog });
}

// POST /api/staff/price-index — admin creates a new price index item.
// Body: { name_ru, name_tj?, emoji?, unit, category, item_key?, image_url? }
export async function POST(request: Request) {
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.name_ru?.trim()) {
    return NextResponse.json({ error: 'missing_name_ru' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  // Auto-generate item_key from name if not provided
  const itemKey =
    body.item_key?.trim() ||
    body.name_ru
      .trim()
      .toLowerCase()
      .replace(/[^a-zа-яёa-z0-9]+/gi, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 60) +
      '_' +
      Date.now().toString(36);

  // Determine max sort_order
  const { data: maxRow } = await supabase
    .from('price_index')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = (maxRow?.sort_order ?? -1) + 1;

  const { error } = await supabase.from('price_index').insert({
    item_key: itemKey,
    effective_date: today,
    name_ru: body.name_ru.trim(),
    name_tj: body.name_tj?.trim() || body.name_ru.trim(),
    unit: body.unit || 'kg',
    category: body.category || 'fruit',
    emoji: body.emoji?.trim() || null,
    image_url: body.image_url?.trim() || null,
    region: null,
    sort_order: sortOrder,
    is_published: true,
    trend: 'flat',
  });

  if (error) {
    return NextResponse.json({ error: 'create_failed', detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, item_key: itemKey });
}

// DELETE /api/staff/price-index — admin removes all rows for an item_key.
// Body: { item_key }
export async function DELETE(request: Request) {
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.item_key) {
    return NextResponse.json({ error: 'missing_item_key' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('price_index')
    .delete()
    .eq('item_key', body.item_key);

  if (error) {
    return NextResponse.json({ error: 'delete_failed', detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// PATCH /api/staff/price-index — operator updates today's prices for an item.
// Body: { item_key, farm_low, farm_high, bazaar_low, bazaar_high, trend }
export async function PATCH(request: Request) {
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'operator' && session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.item_key) {
    return NextResponse.json({ error: 'missing_item_key' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  // Pull yesterday's bazaar midpoint to auto-compute the trend if not given
  const num = (v: unknown) => (v === '' || v == null ? null : Number(v));
  const update: Record<string, unknown> = {
    farm_low: num(body.farm_low),
    farm_high: num(body.farm_high),
    bazaar_low: num(body.bazaar_low),
    bazaar_high: num(body.bazaar_high),
    updated_at: new Date().toISOString(),
  };
  if (body.trend && ['up', 'down', 'flat'].includes(body.trend)) {
    update.trend = body.trend;
  }
  // Allow explicitly setting/clearing the photo (admin only)
  if (session.role === 'admin' && 'image_url' in body) {
    update.image_url = body.image_url?.trim() || null;
  }

  // Upsert today's row for this item (carries over name/category from the
  // most recent prior row so the operator only edits numbers)
  const { data: prior } = await supabase
    .from('price_index')
    .select('name_tj, name_ru, unit, category, emoji, image_url, region, sort_order')
    .eq('item_key', body.item_key)
    .order('effective_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .from('price_index')
    .upsert(
      {
        item_key: body.item_key,
        effective_date: today,
        name_tj: prior?.name_tj ?? body.item_key,
        name_ru: prior?.name_ru ?? body.item_key,
        unit: prior?.unit ?? 'kg',
        category: prior?.category ?? 'fruit',
        emoji: prior?.emoji ?? null,
        image_url: prior?.image_url ?? null,
        region: prior?.region ?? null,
        sort_order: prior?.sort_order ?? 0,
        is_published: true,
        ...update,
      },
      { onConflict: 'item_key,effective_date' },
    );

  if (error) {
    return NextResponse.json({ error: 'save_failed', detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
