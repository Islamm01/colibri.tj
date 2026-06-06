// =====================================================================
// Colibri — Session tokens (HMAC-SHA256, no external deps)
// Format: base64url(payload).base64url(signature)
// Payload: { userId, phone, name, iat, exp }
// =====================================================================

const SESSION_COOKIE = 'colibri_session';
const MAX_AGE_DAYS = 90;

interface SessionPayload {
  userId: string;
  phone: string;
  name: string;
  iat: number; // issued at (unix seconds)
  exp: number; // expiry (unix seconds)
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    // Dev fallback. In production this MUST be set in env.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET must be set in production');
    }
    return 'colibri-dev-secret-do-not-use-in-production-please-set-SESSION_SECRET';
  }
  return secret;
}

function base64UrlEncode(data: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof data === 'string') {
    bytes = new TextEncoder().encode(data);
  } else if (data instanceof ArrayBuffer) {
    bytes = new Uint8Array(data);
  } else {
    bytes = data;
  }
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - (str.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacSign(message: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return base64UrlEncode(sig);
}

async function constantTimeEqual(a: string, b: string): Promise<boolean> {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

export async function signSession(input: Omit<SessionPayload, 'iat' | 'exp'>): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    ...input,
    iat: now,
    exp: now + MAX_AGE_DAYS * 24 * 60 * 60,
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const sig = await hmacSign(encoded, getSecret());
  return `${encoded}.${sig}`;
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const [encoded, sig] = token.split('.');
    if (!encoded || !sig) return null;

    const expectedSig = await hmacSign(encoded, getSecret());
    if (!(await constantTimeEqual(sig, expectedSig))) return null;

    const payloadBytes = base64UrlDecode(encoded);
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes)) as SessionPayload;

    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_CONFIG = {
  cookieName: SESSION_COOKIE,
  maxAge: MAX_AGE_DAYS * 24 * 60 * 60,
};
