import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { readStaffSession } from '@/lib/staff/session';

export const dynamic = 'force-dynamic';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'store_owner' || !session.storeId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));

  const supabase = getSupabaseAdmin();

  // Verify product belongs to this store
  const { data: existing } = await supabase
    .from('products')
    .select('id, store_id, images')
    .eq('id', id)
    .maybeSingle();

  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (existing.store_id !== session.storeId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Build updates from allowed fields only
  const updates: Record<string, unknown> = {};
  const allowed = ['name_tj', 'name_ru', 'description_tj', 'description_ru', 'category', 'price', 'unit', 'stock', 'is_available', 'is_wholesale', 'min_quantity'];
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (body.image_url !== undefined) {
    updates.images = body.image_url
      ? [{ url: body.image_url, w: 800, h: 800 }]
      : [];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 });
  }

  const { data: product, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (error || !product) {
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }
  return NextResponse.json({ product });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'store_owner' || !session.storeId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data: existing } = await supabase
    .from('products')
    .select('id, store_id')
    .eq('id', id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (existing.store_id !== session.storeId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  // Soft delete: mark unavailable rather than physical delete (preserves order history)
  await supabase
    .from('products')
    .update({ is_available: false })
    .eq('id', id);

  return NextResponse.json({ ok: true });
}
