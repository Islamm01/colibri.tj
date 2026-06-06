// =====================================================================
// Colibri — Password hashing for staff accounts
//
// We use PBKDF2-SHA256 via Web Crypto (works in both Node and Edge runtimes).
// 600,000 iterations is the OWASP 2023 recommendation for PBKDF2-SHA256
// and is roughly equivalent to bcrypt cost=12.
//
// Format: pbkdf2$<iterations>$<base64-salt>$<base64-hash>
// =====================================================================

const ITERATIONS = 600_000;
const HASH_LENGTH_BYTES = 32;
const SALT_LENGTH_BYTES = 16;

function base64FromBytes(bytes: Uint8Array): string {
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function bytesFromBase64(b64: string): Uint8Array {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/') +
    '=='.slice(0, (4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function pbkdf2(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    passwordKey,
    HASH_LENGTH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH_BYTES));
  const hash = await pbkdf2(password, salt, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${base64FromBytes(salt)}$${base64FromBytes(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split('$');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
    const iterations = parseInt(parts[1], 10);
    const salt = bytesFromBase64(parts[2]);
    const expectedHash = bytesFromBase64(parts[3]);

    const computed = await pbkdf2(password, salt, iterations);

    // Constant-time comparison
    if (computed.length !== expectedHash.length) return false;
    let diff = 0;
    for (let i = 0; i < computed.length; i++) diff |= computed[i] ^ expectedHash[i];
    return diff === 0;
  } catch {
    return false;
  }
}

/**
 * Deterministic hash for seeding — uses a fixed salt so the migration SQL can
 * contain a known hash. NEVER use this for real user passwords.
 */
export async function deterministicSeedHash(password: string, saltString: string): Promise<string> {
  const salt = new TextEncoder().encode(saltString);
  // Pad/truncate salt to expected length
  const padded = new Uint8Array(SALT_LENGTH_BYTES);
  padded.set(salt.slice(0, SALT_LENGTH_BYTES));
  const hash = await pbkdf2(password, padded, ITERATIONS);
  return `pbkdf2$${ITERATIONS}$${base64FromBytes(padded)}$${base64FromBytes(hash)}`;
}
