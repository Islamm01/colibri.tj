// =====================================================================
// Colibri — Product categories (single source of truth)
//
// The `products.category` column is free text in the DB. These are the
// categories the storefront knows how to LABEL and ORDER. Keep this list
// in sync with the `marketplace.category.*` i18n keys in
// messages/ru.json + messages/tj.json.
// =====================================================================

export const PRODUCT_CATEGORIES = [
  'fresh',
  'dried',
  'berries',
  'citrus',
  'honey',
  'gift_box',
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

// A gift box (`gift_box`) is sold as a single SKU at one price — modeled as a
// normal product with unit = 'piece'. Honey is also a normal product (jar) at
// unit = 'piece'/'pack'; no enum change needed.
// TODO: future — itemized bundle contents (compose a gift box from N products).

// Display order on the storefront — lower sorts first. Premium giftable
// lines (honey, gift boxes) sit after the everyday produce sections.
const CATEGORY_ORDER: Record<string, number> = {
  fresh: 10,
  dried: 20,
  berries: 30,
  citrus: 40,
  honey: 50,
  gift_box: 60,
};

/** Sort weight for a category; unknown/free-text categories fall to the end. */
export function categoryOrder(cat: string): number {
  return CATEGORY_ORDER[cat] ?? 1000;
}

/** True when we have a localized label for this category under marketplace.category.* */
export function isKnownCategory(cat: string): cat is ProductCategory {
  return (PRODUCT_CATEGORIES as readonly string[]).includes(cat);
}
