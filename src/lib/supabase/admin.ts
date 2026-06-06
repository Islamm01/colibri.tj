import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let admin: SupabaseClient | null = null;

/**
 * Service-role Supabase client. Used by API routes for trusted operations
 * (creating users, writing orders, etc.). NEVER expose this to the browser.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (admin) return admin;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
    );
  }

  admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}
