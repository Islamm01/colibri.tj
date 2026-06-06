import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import { normalizePhone } from '@/lib/validation';
import { verifyPassword } from '@/lib/staff/password';
import { writeStaffSession } from '@/lib/staff/session';
import type { UserRole } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: { phone?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
  }

  const phone = normalizePhone(body.phone ?? '');
  const password = body.password;

  if (!phone || !password) {
    return NextResponse.json({ error: 'missing_credentials' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data: user } = await supabase
    .from('users')
    .select('id, phone, name, role, password_hash')
    .eq('phone', phone)
    .maybeSingle();

  // Generic error message regardless of which field is wrong — prevents account enumeration
  const GENERIC_ERROR = NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });

  if (!user || !user.password_hash) return GENERIC_ERROR;
  if (user.role === 'customer') return GENERIC_ERROR;

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return GENERIC_ERROR;

  // Find the store this owner manages (if any)
  let storeId: string | undefined;
  if (user.role === 'store_owner') {
    const { data: store } = await supabase
      .from('stores')
      .select('id')
      .eq('owner_id', user.id)
      .maybeSingle();
    storeId = store?.id;
  }

  await writeStaffSession({
    userId: user.id,
    phone: user.phone,
    name: user.name ?? user.phone,
    role: user.role as Exclude<UserRole, 'customer'>,
    storeId,
  });

  return NextResponse.json({
    ok: true,
    role: user.role,
    storeId,
  });
}
