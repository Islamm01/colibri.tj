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

// GET — platform settings + dispatch mode + zones in one call
export async function GET() {
  const { error } = await requireAdmin();
  if (error) return error;

  const supabase = getSupabaseAdmin();
  const [{ data: settings }, { data: dispatch }, { data: zones }] = await Promise.all([
    supabase.from('platform_settings').select('*').eq('id', 1).maybeSingle(),
    supabase.from('dispatch_config').select('mode').eq('id', 1).maybeSingle(),
    supabase.from('delivery_zones').select('*').order('sort_order', { ascending: true }),
  ]);

  return NextResponse.json({
    settings: settings ?? null,
    dispatchMode: dispatch?.mode ?? 'broadcast',
    zones: zones ?? [],
  });
}

// PATCH — update platform settings and/or dispatch mode
export async function PATCH(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const supabase = getSupabaseAdmin();

  // Dispatch mode
  if (body.dispatchMode && ['broadcast', 'sequential'].includes(body.dispatchMode)) {
    await supabase
      .from('dispatch_config')
      .upsert({ id: 1, mode: body.dispatchMode, updated_at: new Date().toISOString() });
  }

  // Platform settings — numeric fields only
  const numericKeys = [
    'parcel_base_fare', 'parcel_base_km', 'parcel_per_km', 'parcel_heavy_surcharge',
    'parcel_max_km', 'fruit_delivery_fee', 'fruit_free_delivery_over', 'default_commission_rate',
    'courier_commission_rate',
  ];
  const update: Record<string, unknown> = {};
  for (const k of numericKeys) {
    if (k in body) update[k] = body[k] === null || body[k] === '' ? null : Number(body[k]);
  }
  if (typeof body.support_telegram === 'string') update.support_telegram = body.support_telegram;

  if (Object.keys(update).length) {
    update.updated_at = new Date().toISOString();
    const { error: upErr } = await supabase.from('platform_settings').upsert({ id: 1, ...update });
    if (upErr) return NextResponse.json({ error: 'save_failed', detail: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
