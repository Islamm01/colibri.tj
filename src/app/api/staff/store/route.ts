import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { readStaffSession } from '@/lib/staff/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'store_owner' || !session.storeId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  const { data: store } = await supabase
    .from('stores')
    .select('*')
    .eq('id', session.storeId)
    .maybeSingle();

  if (!store) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json({ store });
}

export async function PATCH(request: Request) {
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'store_owner' || !session.storeId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));

  const updates: Record<string, unknown> = {};
  const allowed = ['name', 'description_tj', 'description_ru', 'address', 'opening_hours', 'is_paused', 'prep_time_minutes', 'logo_url', 'cover_image_url'];
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'nothing_to_update' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: store, error } = await supabase
    .from('stores')
    .update(updates)
    .eq('id', session.storeId)
    .select('*')
    .single();

  if (error || !store) {
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }
  return NextResponse.json({ store });
}
