import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { readStaffSession } from '@/lib/staff/session';
import { hashPassword } from '@/lib/staff/password';
import { normalizePhone } from '@/lib/validation';

export const dynamic = 'force-dynamic';

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9а-яёҷқўғҳӣ\s-]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);
  return base || 'store';
}

function randomPassword(): string {
  // Readable temporary password: colibri-XXXX
  const n = Math.floor(1000 + Math.random() * 9000);
  return `colibri-${n}`;
}

// GET — list applications (admin only)
export async function GET(request: Request) {
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  const supabase = getSupabaseAdmin();
  let query = supabase
    .from('partner_applications')
    .select('*')
    .order('created_at', { ascending: false });
  if (status) query = query.eq('status', status);

  const { data } = await query;
  return NextResponse.json({ applications: data ?? [] });
}

// POST — approve an application: create store + store_owner account.
// Body: { applicationId, lat, lng, commission_rate? }
export async function POST(request: Request) {
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body?.applicationId) {
    return NextResponse.json({ error: 'missing_application' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: app } = await supabase
    .from('partner_applications')
    .select('*')
    .eq('id', body.applicationId)
    .maybeSingle();
  if (!app) return NextResponse.json({ error: 'application_not_found' }, { status: 404 });
  if (app.status === 'approved') {
    return NextResponse.json({ error: 'already_approved' }, { status: 400 });
  }

  const phone = normalizePhone(app.phone);
  if (!phone) return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });

  // 1. Create (or find) the store-owner user account
  const { data: existingUser } = await supabase
    .from('users')
    .select('id, role')
    .eq('phone', phone)
    .maybeSingle();

  const tempPassword = randomPassword();
  let ownerId: string;

  if (existingUser) {
    ownerId = existingUser.id;
    // Promote to store_owner and set a password if they were a soft customer
    await supabase
      .from('users')
      .update({ role: 'store_owner', password_hash: await hashPassword(tempPassword) })
      .eq('id', ownerId);
  } else {
    const { data: newUser, error: userErr } = await supabase
      .from('users')
      .insert({
        phone,
        name: app.contact_name,
        role: 'store_owner',
        password_hash: await hashPassword(tempPassword),
      })
      .select('id')
      .single();
    if (userErr || !newUser) {
      return NextResponse.json({ error: 'user_create_failed', detail: userErr?.message }, { status: 500 });
    }
    ownerId = newUser.id;
  }

  // 2. Create the store
  const vertical = app.vertical === 'pharmacy' ? 'pharmacy' : app.vertical === 'agro' ? 'agro' : 'fruits';
  const slug = `${slugify(app.business_name)}-${Math.floor(Math.random() * 1000)}`;
  const { data: store, error: storeErr } = await supabase
    .from('stores')
    .insert({
      vertical,
      category: app.category ?? null,
      name: app.business_name,
      slug,
      owner_id: ownerId,
      lat: Number(body.lat) || 40.2837,
      lng: Number(body.lng) || 69.6219,
      address: app.address ?? null,
      commission_rate: body.commission_rate != null ? Number(body.commission_rate) : 0.1,
      is_active: true,
      is_paused: true, // start paused until they add products
    })
    .select('id, slug')
    .single();
  if (storeErr || !store) {
    return NextResponse.json({ error: 'store_create_failed', detail: storeErr?.message }, { status: 500 });
  }

  // 3. Mark application approved
  await supabase
    .from('partner_applications')
    .update({ status: 'approved', decided_at: new Date().toISOString() })
    .eq('id', body.applicationId);

  // Return the credentials so the admin can pass them to the merchant
  return NextResponse.json({
    ok: true,
    store: { id: store.id, slug: store.slug },
    credentials: { phone, password: tempPassword },
  });
}

// PATCH — update application status (contacted / rejected) without creating a store
export async function PATCH(request: Request) {
  const session = await readStaffSession();
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (session.role !== 'admin') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const body = await request.json().catch(() => null);
  if (!body?.applicationId || !body?.status) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 });
  }
  if (!['new', 'contacted', 'rejected'].includes(body.status)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  await supabase
    .from('partner_applications')
    .update({
      status: body.status,
      contacted_at: body.status === 'contacted' ? new Date().toISOString() : undefined,
    })
    .eq('id', body.applicationId);

  return NextResponse.json({ ok: true });
}
