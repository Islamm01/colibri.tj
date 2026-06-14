// =====================================================================
// Colibri — Product categories (single source of truth)
//
// `products.category` is a free-text column in the DB. This file owns the
// canonical taxonomy the storefront knows how to present: the set, the
// display order, the bilingual labels, and which vertical each category
// belongs to. The customer store page AND the staff product editor both
// derive their category lists from here — do not hardcode category labels
// anywhere else.
// =====================================================================

import type { VerticalType } from './types';

export interface ProductCategoryDef {
  key: string;
  tj: string;
  ru: string;
  vertical: VerticalType;
}

// Ordered: storefront sections and admin dropdowns render in this order.
// Dried fruit and nuts are first-class produce lines (previously folded
// into a single "dried" bucket).
export const PRODUCT_CATEGORIES = [
  { key: 'fresh',    tj: 'Меваҳои тоза', ru: 'Свежие фрукты',      vertical: 'fruits' },
  { key: 'dried',    tj: 'Меваҳои хушк', ru: 'Сухофрукты',         vertical: 'fruits' },
  { key: 'nuts',     tj: 'Чормағз',      ru: 'Орехи',              vertical: 'fruits' },
  { key: 'berries',  tj: 'Буттамеваҳо',  ru: 'Ягоды',              vertical: 'fruits' },
  { key: 'citrus',   tj: 'Цитрусӣ',      ru: 'Цитрусовые',         vertical: 'fruits' },
  { key: 'honey',    tj: 'Асал',         ru: 'Мёд',                vertical: 'fruits' },
  { key: 'gift_box', tj: 'Тӯҳфаҳо',      ru: 'Подарочные наборы',  vertical: 'fruits' },
] as const satisfies readonly ProductCategoryDef[];

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]['key'];

const ORDER_INDEX: Record<string, number> = Object.fromEntries(
  PRODUCT_CATEGORIES.map((c, i) => [c.key, (i + 1) * 10]),
);

/** Sort weight for a category; unknown/free-text categories fall to the end. */
export function categoryOrder(cat: string): number {
  return ORDER_INDEX[cat] ?? 1000;
}

/** True when this is a known category in our taxonomy. */
export function isKnownCategory(cat: string): cat is ProductCategory {
  return PRODUCT_CATEGORIES.some((c) => c.key === cat);
}

/** Localized label for a category; falls back to the raw key for free-text categories. */
export function categoryLabel(cat: string, locale: string): string {
  const def = PRODUCT_CATEGORIES.find((c) => c.key === cat);
  if (!def) return cat;
  return locale === 'ru' ? def.ru : def.tj;
}

// =====================================================================
// Gifts by Colibri — curated gift taxonomy (vertical = 'gifts')
//
// Launch structure is intentionally simple: three entry categories and a
// single combined catalog. The gift TYPE is stored in products.category.
// Staff labels are Russian-only (like the rest of the staff UI);
// customer-facing labels come from the `gifts` i18n namespace.
// =====================================================================

export interface GiftTagDef {
  key: string;
  tj: string;
  ru: string;
}

/** The three launch gift categories. Stored in products.category. */
export const GIFT_TYPES = [
  { key: 'fruit_basket', tj: 'Сабадҳои мева', ru: 'Фруктовые корзины' },
  { key: 'honey',        tj: 'Маҷмӯаи асал',  ru: 'Медовые наборы' },
  { key: 'gift_box',     tj: 'Қуттиҳои тӯҳфа', ru: 'Подарочные коробки' },
] as const satisfies readonly GiftTagDef[];

export type GiftType = (typeof GIFT_TYPES)[number]['key'];

export function isGiftType(key: string): key is GiftType {
  return GIFT_TYPES.some((g) => g.key === key);
}

/** Localized label for a gift category; falls back to the raw key. */
export function giftTagLabel(key: string, locale: string): string {
  const def = GIFT_TYPES.find((g) => g.key === key);
  if (!def) return key;
  return locale === 'ru' ? def.ru : def.tj;
}
