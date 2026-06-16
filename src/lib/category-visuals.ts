// =====================================================================
// Colibri — curated category visuals (single source of truth)
//
// Permanent, branded background assets for every category surface. These
// are committed SVG brand panels in /public/categories — they do NOT
// depend on store covers, product photos, or any uploaded content, and
// they never appear empty. To swap in licensed photography later, drop a
// file at the same path (e.g. /categories/fruits.jpg) and update the path
// here — no other code changes needed.
// =====================================================================

/** Home pillar visuals (the three consumer pillars). */
export const PILLAR_IMAGES = {
  fruits: '/categories/fruits.svg',
  parcel: '/categories/parcel.svg',
  gifts: '/categories/gifts.svg',
} as const;

/** Gift category visuals (keys match GIFT_TYPES in lib/categories). */
export const GIFT_CATEGORY_IMAGES: Record<string, string> = {
  fruit_basket: '/categories/fruit_basket.svg',
  honey: '/categories/honey.svg',
  gift_box: '/categories/gift_box.svg',
};

/** Resolve a gift category's permanent cover; falls back to the gifts panel. */
export function giftCategoryImage(type: string): string {
  return GIFT_CATEGORY_IMAGES[type] ?? PILLAR_IMAGES.gifts;
}
