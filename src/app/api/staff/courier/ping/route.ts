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
  if (!coords) return NextResponse.json({ error: 'invalid_location' }, { status: 400 });

  const supabase = getSupabaseAdmin();

  await supabase
    .from('couriers')
    .update({
      last_lat: coords.lat,
      last_lng: coords.lng,
      last_ping_at: new Date().toISOString(),
    })
    .eq('user_id', session.userId);

  return NextResponse.json({ ok: true });
}
