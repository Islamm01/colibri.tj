import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { readStaffSession } from '@/lib/staff/session';
import { hashPassword } from '@/lib/staff/password';
import { normalizePhone, isValidName } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const VEHICLES = ['moto', 'bike', 'car', 'foot'];

function randomPassword(): string {
  return `colibri-${Math.floor(1000 + Math.random() * 9000)}`;
}

// POST — public: submit a courier application
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  if (!isValidName(body.full_name ?? '')) {
    return NextResponse.json({ error: 'invalid_name' }, { status: 400 });
  }
  const phone = normalizePhone(body.phone ?? '');
  if (!phone) return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });
  if (!body.accepted_terms) {
    return NextResponse.json({ error: 'terms_not_accepted' }, { status: 400 });
  }
  const vehicle = VEHICLES.includes(body.vehicle) ? body.vehicle : 'moto';

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('courier_applications').insert({
    full_name: body.full_name.trim(),
    phone,
    vehicle,
    has_smartphone: body.has_smartphone !== false,
    district: body.district?.trim() || null,
    about: body.about?.trim() || null,
    accepted_terms: true,
  });
  if (error) {
    return NextResponse.json({ error: 'save_failed', detail: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

// GET — admin: list courier applications
export async function GET(request: Request) {
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const supabase = getSupabaseAdmin();
  let query = supabase.from('courier_applications').select('*').order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);
  const { data } = await query;
  return NextResponse.json({ applications: data ?? [] });
}

// PATCH — admin: approve (create courier login) / contacted / rejected
export async function PATCH(request: Request) {
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body?.applicationId || !body?.action) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data: app } = await supabase
    .from('courier_applications')
    .select('*')
    .eq('id', body.applicationId)
    .maybeSingle();
  if (!app) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (body.action === 'contacted' || body.action === 'rejected') {
    await supabase
      .from('courier_applications')
      .update({
        status: body.action,
        contacted_at: body.action === 'contacted' ? new Date().toISOString() : undefined,
        decided_at: body.action === 'rejected' ? new Date().toISOString() : undefined,
      })
      .eq('id', body.applicationId);
    return NextResponse.json({ ok: true });
  }

  if (body.action !== 'approve') {
    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  }
  if (app.status === 'approved') {
    return NextResponse.json({ error: 'already_approved' }, { status: 400 });
  }

  const phone = normalizePhone(app.phone);
  if (!phone) return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });

  // Create or promote the courier user account
  const tempPassword = randomPassword();
  const { data: existing } = await supabase.from('users').select('id').eq('phone', phone).maybeSingle();

  let courierId: string;
  if (existing) {
    courierId = existing.id;
    await supabase
      .from('users')
      .update({ role: 'courier', password_hash: await hashPassword(tempPassword) })
      .eq('id', courierId);
  } else {
    const { data: newUser, error: uErr } = await supabase
      .from('users')
      .insert({ phone, name: app.full_name, role: 'courier', password_hash: await hashPassword(tempPassword) })
      .select('id')
      .single();
    if (uErr || !newUser) {
      return NextResponse.json({ error: 'user_create_failed', detail: uErr?.message }, { status: 500 });
    }
    courierId = newUser.id;
  }

  // Ensure a couriers row exists (offline by default)
  await supabase.from('couriers').upsert({ user_id: courierId, status: 'offline' }, { onConflict: 'user_id' });

  await supabase
    .from('courier_applications')
    .update({ status: 'approved', decided_at: new Date().toISOString() })
    .eq('id', body.applicationId);

  return NextResponse.json({ ok: true, credentials: { phone, password: tempPassword } });
}
