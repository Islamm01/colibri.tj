import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { signSession, verifySession, SESSION_CONFIG } from '@/lib/session/token';
import type { UserRole } from '@/lib/types';

const STAFF_COOKIE = 'colibri_staff';

export interface StaffSession {
  userId: string;
  phone: string;
  name: string;
  role: Exclude<UserRole, 'customer'>;
  storeId?: string;
}

export async function readStaffSession(): Promise<StaffSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(STAFF_COOKIE)?.value;
  if (!token) return null;

  const payload = await verifySession(token);
  if (!payload) return null;

  // Staff sessions encode role + optional store id in the name field as JSON.
  // We reuse the token signing infrastructure but stuff extra data into a JSON-encoded "name".
  try {
    const extra = JSON.parse(payload.name);
    if (!extra.role || extra.role === 'customer') return null;
    return {
      userId: payload.userId,
      phone: payload.phone,
      name: extra.name,
      role: extra.role,
      storeId: extra.storeId,
    };
  } catch {
    return null;
  }
}

export async function writeStaffSession(session: StaffSession): Promise<void> {
  const cookieStore = await cookies();
  const encodedName = JSON.stringify({
    name: session.name,
    role: session.role,
    storeId: session.storeId,
  });
  const token = await signSession({
    userId: session.userId,
    phone: session.phone,
    name: encodedName,
  });
  cookieStore.set(STAFF_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_CONFIG.maxAge,
    path: '/',
  });
}

export async function clearStaffSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(STAFF_COOKIE);
}

/**
 * Server-side guard for staff routes. Use at the top of layouts/pages:
 *
 *   const session = await requireStaff(['store_owner']);
 *
 * Redirects to /staff/login if not authenticated or wrong role.
 */
export async function requireStaff(
  allowedRoles: Array<Exclude<UserRole, 'customer'>>,
): Promise<StaffSession> {
  const session = await readStaffSession();
  if (!session) {
    redirect('/staff/login');
  }
  if (!allowedRoles.includes(session.role)) {
    // Wrong role — send them to the default landing for their actual role
    redirect(roleHomePath(session.role));
  }
  return session;
}

export function roleHomePath(role: StaffSession['role']): string {
  switch (role) {
    case 'store_owner':
      return '/staff/store';
    case 'operator':
      return '/staff/operator';
    case 'admin':
      return '/staff/admin';
    case 'courier':
      return '/staff/courier';
    default:
      return '/staff/login';
  }
}
