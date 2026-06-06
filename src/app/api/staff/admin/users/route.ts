import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { readStaffSession } from '@/lib/staff/session';
import { hashPassword } from '@/lib/staff/password';
import { normalizePhone, isValidName } from '@/lib/validation';

export const dynamic = 'force-dynamic';

const STAFF_ROLES = ['courier', 'operator', 'store_owner', 'admin'];

async function requireAdmin() {
  const session = await readStaffSession();
  if (!session) return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  if (session.role !== 'admin') return { error: NextResponse.json({ error: 'forbidden' }, { status: 403 }) };
  return { session };
}

// GET — list staff users (optionally filtered by role)
export async function GET(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');

  const supabase = getSupabaseAdmin();
  let q = supabase
    .from('users')
    .select('id, name, phone, role, created_at')
    .in('role', role ? [role] : STAFF_ROLES)
    .order('created_at', { ascending: false });
  if (role) q = q.eq('role', role);

  const { data } = await q;

  // For couriers, attach current online status
  let courierStatus: Record<string, string> = {};
  const courierIds = (data ?? []).filter((u) => u.role === 'courier').map((u) => u.id);
  if (courierIds.length) {
    const { data: couriers } = await supabase
      .from('couriers')
      .select('user_id, status')
      .in('user_id', courierIds);
    courierStatus = Object.fromEntries((couriers ?? []).map((c) => [c.user_id, c.status]));
  }

  const shaped = (data ?? []).map((u) => ({
    id: u.id,
    name: u.name,
    phone: u.phone,
    role: u.role,
    status: u.role === 'courier' ? (courierStatus[u.id] ?? 'offline') : null,
    created_at: u.created_at,
  }));

  return NextResponse.json({ users: shaped });
}

// POST — create a new staff account. Body: { name, phone, role, password }
export async function POST(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!isValidName(body?.name ?? '')) {
    return NextResponse.json({ error: 'invalid_name' }, { status: 400 });
  }
  const phone = normalizePhone(body?.phone ?? '');
  if (!phone) return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });
  if (!STAFF_ROLES.includes(body?.role)) {
    return NextResponse.json({ error: 'invalid_role' }, { status: 400 });
  }
  const password = String(body?.password ?? '');
  if (password.length < 6) {
    return NextResponse.json({ error: 'weak_password' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Phone must be unique
  const { data: existing } = await supabase.from('users').select('id').eq('phone', phone).maybeSingle();
  if (existing) return NextResponse.json({ error: 'phone_taken' }, { status: 409 });

  const { data: user, error: insErr } = await supabase
    .from('users')
    .insert({
      name: body.name.trim(),
      phone,
      role: body.role,
      password_hash: await hashPassword(password),
    })
    .select('id')
    .single();
  if (insErr || !user) {
    return NextResponse.json({ error: 'create_failed', detail: insErr?.message }, { status: 500 });
  }

  // Couriers get a couriers row so dispatch can see them
  if (body.role === 'courier') {
    await supabase.from('couriers').upsert({ user_id: user.id, status: 'offline' });
  }

  return NextResponse.json({ ok: true, userId: user.id });
}

// PATCH — reset a staff member's password. Body: { userId, password }
export async function PATCH(request: Request) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body?.userId) return NextResponse.json({ error: 'missing_user' }, { status: 400 });
  const password = String(body?.password ?? '');
  if (password.length < 6) return NextResponse.json({ error: 'weak_password' }, { status: 400 });

  const supabase = getSupabaseAdmin();

  // Only allow resetting passwords for staff accounts, never customers
  const { data: target } = await supabase.from('users').select('role').eq('id', body.userId).maybeSingle();
  if (!target) return NextResponse.json({ error: 'user_not_found' }, { status: 404 });
  if (target.role === 'customer') return NextResponse.json({ error: 'forbidden' }, { status: 403 });

  const { error: upErr } = await supabase
    .from('users')
    .update({ password_hash: await hashPassword(password), updated_at: new Date().toISOString() })
    .eq('id', body.userId);
  if (upErr) return NextResponse.json({ error: 'update_failed', detail: upErr.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
