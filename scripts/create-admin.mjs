#!/usr/bin/env node
// =====================================================================
// Colibri — Create first admin user
//
// Generates production-ready SQL for pasting into Supabase SQL Editor.
// Uses the identical PBKDF2-SHA256 algorithm from src/lib/staff/password.ts
// so the hash will be accepted by the login route without any changes.
//
// Usage:
//   node scripts/create-admin.mjs <phone> <password> <name>
//
// Example:
//   node scripts/create-admin.mjs +992921234567 "MySecret99" "Ali Karimov"
//
// Requirements: Node >= 18.17 (Web Crypto built in)
// =====================================================================

const ITERATIONS      = 600_000;
const HASH_BYTES      = 32;
const SALT_BYTES      = 16;

// ---------- crypto helpers (mirrors src/lib/staff/password.ts) ----------

function base64FromBytes(bytes) {
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function pbkdf2Hash(password, salt) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    key,
    HASH_BYTES * 8,
  );
  return new Uint8Array(bits);
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await pbkdf2Hash(password, salt);
  return `pbkdf2$${ITERATIONS}$${base64FromBytes(salt)}$${base64FromBytes(hash)}`;
}

// ---------- phone normalizer (mirrors src/lib/validation.ts) ----------

function normalizePhone(input) {
  if (!input) return null;
  let digits = input.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  if (digits.length === 9)                            return `+992${digits}`;
  if (digits.length === 12 && digits.startsWith('992')) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith('992')) return `+${digits}`;
  return null;
}

// ---------- SQL escaping ----------

function sqlStr(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

// ---------- main ----------

async function main() {
  const [,, rawPhone, password, ...nameParts] = process.argv;
  const name = nameParts.join(' ');

  if (!rawPhone || !password || !name) {
    console.error('Usage: node scripts/create-admin.mjs <phone> <password> <name>');
    console.error('Example: node scripts/create-admin.mjs +992921234567 "MySecret99" "Ali Karimov"');
    process.exit(1);
  }

  if (password.length < 6) {
    console.error('Error: password must be at least 6 characters.');
    process.exit(1);
  }

  const phone = normalizePhone(rawPhone);
  if (!phone) {
    console.error(`Error: "${rawPhone}" is not a valid Tajik phone number.`);
    console.error('Accepted formats: +992921234567 | 992921234567 | 921234567');
    process.exit(1);
  }

  if (name.trim().length < 2 || name.trim().length > 80) {
    console.error('Error: name must be 2–80 characters.');
    process.exit(1);
  }

  process.stderr.write('Hashing password (600 000 PBKDF2-SHA256 iterations) … ');
  const passwordHash = await hashPassword(password);
  process.stderr.write('done.\n\n');

  // ----------------------------------------------------------------
  // Output
  // ----------------------------------------------------------------

  const banner = `-- =====================================================================
-- Colibri admin user
-- Generated: ${new Date().toISOString()}
-- Phone    : ${phone}
-- Name     : ${name.trim()}
-- Role     : admin
-- =====================================================================`;

  const insertSql = `${banner}

-- ---------------------------------------------------------------
-- Option A: INSERT a brand-new admin user
-- Paste this into Supabase → SQL Editor and run it.
-- If the phone already exists the INSERT is skipped (ON CONFLICT).
-- ---------------------------------------------------------------
INSERT INTO users (phone, name, role, password_hash, locale)
VALUES (
  ${sqlStr(phone)},
  ${sqlStr(name.trim())},
  'admin',
  ${sqlStr(passwordHash)},
  'ru'
)
ON CONFLICT (phone) DO NOTHING;

-- ---------------------------------------------------------------
-- Option B: PROMOTE an existing user to admin
-- Use this if the phone already exists (e.g. a customer account).
-- It also sets the password hash so the staff login works.
-- IMPORTANT: review the WHERE clause before running — this will
-- change the role of whichever row matches that phone number.
-- ---------------------------------------------------------------
-- UPDATE users
-- SET
--   role          = 'admin',
--   password_hash = ${sqlStr(passwordHash)},
--   name          = ${sqlStr(name.trim())},
--   updated_at    = now()
-- WHERE phone = ${sqlStr(phone)};

-- ---------------------------------------------------------------
-- Verify the result
-- ---------------------------------------------------------------
-- SELECT id, phone, name, role, created_at
-- FROM users
-- WHERE phone = ${sqlStr(phone)};`;

  console.log(insertSql);

  console.error('');
  console.error('┌─────────────────────────────────────────────────────┐');
  console.error('│  Next steps                                          │');
  console.error('├─────────────────────────────────────────────────────┤');
  console.error('│  1. Copy the SQL above into Supabase SQL Editor      │');
  console.error('│     (Project → SQL Editor → New query → Run)         │');
  console.error('│                                                       │');
  console.error('│  2. Log in at:  /staff/login                          │');
  console.error(`│     Phone    :  ${phone.padEnd(37)}│`);
  console.error('│     Password : (what you just entered)                │');
  console.error('│                                                       │');
  console.error('│  3. You will land at:  /staff/admin                   │');
  console.error('└─────────────────────────────────────────────────────┘');
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
