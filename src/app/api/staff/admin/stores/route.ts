import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { readStaffSession } from '@/lib/staff/session';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const session = await readStaffSession();
  if (!session) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  if (session.role !== 'admin') return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  return { session };
}

// GET — list all stores with owner info + product counts
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const supabase = getSupabaseAdmin();
  const { data: stores } = await supabase
    .from('stores')
    .select('id, name, vertical, category, slug, is_active, is_paused, commission_rate, min_order_amount, lat, lng, address, created_at, owner:owner_id (name, phone)')
    .order('created_at', { ascending: false });

  const shaped = (stores ?? []).map((s) => {
    const owner = Array.isArray(s.owner) ? s.owner[0] : s.owner;
    return {
      id: s.id,
      name: s.name,
      vertical: s.vertical,
      category: s.category,
      slug: s.slug,
      is_active: s.is_active,
      is_paused: s.is_paused,
      commission_rate: s.commission_rate,
      min_order_amount: s.min_order_amount,
      address: s.address,
      ownerName: owner?.name ?? '—',
      ownerPhone: owner?.phone ?? '—',
      created_at: s.created_at,
    };
  });
  return NextResponse.json({ stores: shaped });
}

// PATCH — update a store's status / commission / min order
export async function PATCH(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body?.storeId) return NextResponse.json({ error: 'missing_store' }, { status: 400 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ('is_active' in body) update.is_active = !!body.is_active;
  if ('is_paused' in body) update.is_paused = !!body.is_paused;
  if ('commission_rate' in body) {
    const rate = Number(body.commission_rate);
    if (rate >= 0 && rate <= 1) update.commission_rate = rate;
  }
  if ('min_order_amount' in body) {
    const min = Number(body.min_order_amount);
    if (min >= 0) update.min_order_amount = min;
  }

  const supabase = getSupabaseAdmin();
  const { error: upErr } = await supabase.from('stores').update(update).eq('id', body.storeId);
  if (upErr) return NextResponse.json({ error: 'update_failed', detail: upErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
