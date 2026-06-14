import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { readStaffSession } from '@/lib/staff/session';
import type { ProductUnit } from '@/lib/types';

export const dynamic = 'force-dynamic';

const VALID_UNITS: ProductUnit[] = ['kg', 'piece', 'pack', 'gram', 'ton'];

export async function GET() {
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'store_owner' || !session.storeId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .eq('store_id', session.storeId)
    .order('sort_order');

  // Surface the store's vertical so the editor can show gift-specific fields.
  const { data: store } = await supabase
    .from('stores')
    .select('vertical')
    .eq('id', session.storeId)
    .maybeSingle();

  return NextResponse.json({ products: products ?? [], store_vertical: store?.vertical ?? null });
}

export async function POST(request: Request) {
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'store_owner' || !session.storeId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  let body: {
    name_tj?: string;
    name_ru?: string;
    description_tj?: string;
    description_ru?: string;
    category?: string;
    price?: number;
    unit?: ProductUnit;
    stock?: number | null;
    image_url?: string;
    is_wholesale?: boolean;
    min_quantity?: number | null;
    gift_contents?: string;
    is_category_cover?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  if (!body.name_tj?.trim() || !body.name_ru?.trim()) {
    return NextResponse.json({ error: 'missing_name' }, { status: 400 });
  }
  if (typeof body.price !== 'number' || body.price < 0) {
    return NextResponse.json({ error: 'invalid_price' }, { status: 400 });
  }
  if (!body.unit || !VALID_UNITS.includes(body.unit)) {
    return NextResponse.json({ error: 'invalid_unit' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Get current max sort_order for this store
  const { data: maxRow } = await supabase
    .from('products')
    .select('sort_order')
    .eq('store_id', session.storeId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = (maxRow?.sort_order ?? 0) + 1;

  const images = body.image_url
    ? [{ url: body.image_url, w: 800, h: 800 }]
    : [];

  const category = body.category?.trim() || null;

  // At most one cover per (store, category): clear any existing cover for this
  // category before inserting the new one as cover.
  if (body.is_category_cover && category) {
    await supabase
      .from('products')
      .update({ is_category_cover: false })
      .eq('store_id', session.storeId)
      .eq('category', category)
      .eq('is_category_cover', true);
  }

  const { data: product, error } = await supabase
    .from('products')
    .insert({
      store_id: session.storeId,
      name_tj: body.name_tj.trim(),
      name_ru: body.name_ru.trim(),
      description_tj: body.description_tj?.trim() || null,
      description_ru: body.description_ru?.trim() || null,
      category,
      price: body.price,
      unit: body.unit,
      stock: body.stock ?? null,
      images,
      is_available: true,
      sort_order: nextOrder,
      is_wholesale: body.is_wholesale ?? false,
      min_quantity: body.is_wholesale ? body.min_quantity ?? null : null,
      gift_contents: body.gift_contents?.trim() || null,
      is_category_cover: body.is_category_cover ?? false,
    })
    .select('*')
    .single();

  if (error || !product) {
    return NextResponse.json({ error: 'create_failed', detail: error?.message }, { status: 500 });
  }

  return NextResponse.json({ product });
}
