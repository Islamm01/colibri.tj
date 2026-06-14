// =====================================================================
// Colibri — store-owner provisioning helpers (shared)
//
// Used both by partner-application approval and by direct admin store
// creation (e.g. the curated Gifts store). Centralizes slug generation,
// the temporary-password scheme, and the "create or promote owner" logic
// so the two flows can never drift apart.
// =====================================================================

import type { getSupabaseAdmin } from '@/lib/supabase/admin';
import { hashPassword } from '@/lib/staff/password';

type AdminClient = ReturnType<typeof getSupabaseAdmin>;

/** URL-safe slug from a store name (keeps Cyrillic/Tajik letters). */
export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9а-яёҷқўғҳӣ\s-]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 40);
  return base || 'store';
}

/** Readable temporary password handed to the merchant: colibri-XXXX. */
export function randomPassword(): string {
  const n = Math.floor(1000 + Math.random() * 9000);
  return `colibri-${n}`;
}

/** Unique store slug = slugified name + a short random suffix. */
export function uniqueStoreSlug(name: string): string {
  return `${slugify(name)}-${Math.floor(Math.random() * 1000)}`;
}

/**
 * Create a brand-new store-owner account, or promote an existing user to
 * store_owner. Always (re)sets a fresh temporary password so the admin can
 * hand off working credentials. Returns the owner id + plaintext password.
 */
export async function provisionStoreOwner(
  supabase: AdminClient,
  phone: string,
  name: string,
): Promise<{ ownerId: string; password: string }> {
  const password = randomPassword();
  const passwordHash = await hashPassword(password);

  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('phone', phone)
    .maybeSingle();

  if (existingUser) {
    await supabase
      .from('users')
      .update({ role: 'store_owner', password_hash: passwordHash })
      .eq('id', existingUser.id);
    return { ownerId: existingUser.id, password };
  }

  const { data: newUser, error } = await supabase
    .from('users')
    .insert({ phone, name, role: 'store_owner', password_hash: passwordHash })
    .select('id')
    .single();
  if (error || !newUser) {
    throw new Error(error?.message || 'user_create_failed');
  }
  return { ownerId: newUser.id, password };
}
