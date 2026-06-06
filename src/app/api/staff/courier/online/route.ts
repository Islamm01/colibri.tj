import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { readStaffSession } from '@/lib/staff/session';
import { isValidLatLng } from '@/lib/validation';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'courier') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const coords = isValidLatLng(body.lat, body.lng);

  const supabase = getSupabaseAdmin();

  // Going online does NOT require GPS. If the browser provided coords, store
  // them; otherwise the courier is still online and will get broadcast offers,
  // with coords filled in on the first successful ping.
  const update: Record<string, unknown> = {
    user_id: session.userId,
    status: 'online',
    last_ping_at: new Date().toISOString(),
  };
  if (coords) {
    update.last_lat = coords.lat;
    update.last_lng = coords.lng;
  }

  await supabase
    .from('couriers')
    .upsert(update)
    .eq('user_id', session.userId);

  return NextResponse.json({ ok: true });
}
