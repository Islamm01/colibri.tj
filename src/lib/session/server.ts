import { cookies } from 'next/headers';
import { signSession, verifySession, SESSION_CONFIG } from './token';

export interface CustomerSession {
  userId: string;
  phone: string;
  name: string;
}

export async function readSession(): Promise<CustomerSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_CONFIG.cookieName)?.value;
  if (!token) return null;

  const payload = await verifySession(token);
  if (!payload) return null;

  return { userId: payload.userId, phone: payload.phone, name: payload.name };
}

export async function writeSession(session: CustomerSession): Promise<void> {
  const cookieStore = await cookies();
  const token = await signSession(session);
  cookieStore.set(SESSION_CONFIG.cookieName, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_CONFIG.maxAge,
    path: '/',
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_CONFIG.cookieName);
}
