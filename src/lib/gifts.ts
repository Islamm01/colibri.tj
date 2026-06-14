// =====================================================================
// Colibri — Gifts by Colibri data helpers (server-side)
//
// The Gifts pillar is a CURATED brand: the customer never sees the
// underlying vendor store(s). These helpers aggregate gift products
// across every active store with vertical = 'gifts' into one catalog.
// =====================================================================

import type { getSupabaseServer } from '@/lib/supabase/server';
import type { Product } from '@/lib/types';

type ServerClient = Awaited<ReturnType<typeof getSupabaseServer>>;

/** IDs of every active gift-vertical store (the curated brand's backing stores). */
export async function getGiftStoreIds(supabase: ServerClient): Promise<string[]> {
  const { data } = await supabase
    .from('stores')
    .select('id')
    .eq('vertical', 'gifts')
    .eq('is_active', true);
  return (data ?? []).map((s: { id: string }) => s.id);
}

/** Available gift sets across the brand, optionally filtered by category type. */
export async function getGiftProducts(
  supabase: ServerClient,
  opts: { type?: string; limit?: number } = {},
): Promise<Product[]> {
  const storeIds = await getGiftStoreIds(supabase);
  if (storeIds.length === 0) return [];

  let query = supabase
    .from('products')
    .select('*')
    .in('store_id', storeIds)
    .eq('is_available', true)
    .order('sort_order');

  if (opts.type) query = query.eq('category', opts.type);
  if (opts.limit) query = query.limit(opts.limit);

  const { data } = await query;
  return (data ?? []) as unknown as Product[];
}

/**
 * Resolve a category's cover image. Uses the operator-pinned cover
 * (is_category_cover) when present, otherwise falls back to the first
 * available product of that category. Pass the already-fetched product
 * list so this stays a pure, query-free lookup.
 */
export function giftCategoryCover(products: Product[], type: string): string | null {
  const pinned = products.find((p) => p.category === type && p.is_category_cover);
  const fallback = products.find((p) => p.category === type);
  return (pinned ?? fallback)?.images?.[0]?.url ?? null;
}

/** A single gift set by id (the route's [slug] segment is the product id). */
export async function getGiftProduct(
  supabase: ServerClient,
  id: string,
): Promise<Product | null> {
  const storeIds = await getGiftStoreIds(supabase);
  if (storeIds.length === 0) return null;

  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('id', id)
    .in('store_id', storeIds)
    .eq('is_available', true)
    .maybeSingle();

  return (data as unknown as Product) ?? null;
}
