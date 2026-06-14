import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { readStaffSession } from '@/lib/staff/session';

export const dynamic = 'force-dynamic';

const STAFF_ROLES = ['operator', 'admin'];

// GET — list custom gift-set requests (operator/admin).
export async function GET(request: Request) {
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!STAFF_ROLES.includes(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('gift_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);

  const { data } = await query;
  return NextResponse.json({ requests: data ?? [] });
}

// PATCH — advance a request's status (operator/admin).
export async function PATCH(request: Request) {
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!STAFF_ROLES.includes(session.role)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.requestId || !body?.status) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }
  if (!['new', 'contacted', 'fulfilled', 'rejected'].includes(body.status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const updates: Record<string, unknown> = { status: body.status };
  if (body.status === 'contacted') updates.contacted_at = new Date().toISOString();
  if (body.status === 'fulfilled' || body.status === 'rejected') {
    updates.decided_at = new Date().toISOString();
  }

  await supabase.from('gift_requests').update(updates).eq('id', body.requestId);
  return NextResponse.json({ ok: true });
}
