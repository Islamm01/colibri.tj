// =====================================================================
// Colibri — Domain types (mirrors supabase/migrations/0001_initial_schema.sql)
// =====================================================================

export type VerticalType =
  | 'fruits'
  | 'parcel'
  | 'pharmacy'
  | 'agro'
  | 'garden'
  | 'farmers';

export type UserRole =
  | 'customer'
  | 'store_owner'
  | 'courier'
  | 'operator'
  | 'admin'
  | 'system';

export type OrderStatus =
  | 'pending_payment'
  | 'placed'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'courier_assigned'
  | 'picked_up'
  | 'delivered'
  | 'cancelled';

export type ProductUnit = 'kg' | 'piece' | 'pack' | 'gram' | 'ton';

export type PaymentMethod = 'cash' | 'qr' | 'bank_transfer';

export type PaymentStatus =
  | 'pending'
  | 'awaiting_confirmation'
  | 'paid'
  | 'failed'
  | 'refunded';

export type OpeningHours = Partial<
  Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', [string, string]>
>;

export interface ProductImage {
  url: string;
  w?: number;
  h?: number;
}

export interface Store {
  id: string;
  vertical: VerticalType;
  category: string | null;
  name: string;
  slug: string;
  description_tj: string | null;
  description_ru: string | null;
  cover_image_url: string | null;
  logo_url: string | null;
  lat: number;
  lng: number;
  address: string | null;
  opening_hours: OpeningHours | null;
  is_paused: boolean;
  is_active: boolean;
  prep_time_minutes: number;
  rating: number | null;
  rating_count: number;
}

export interface Product {
  id: string;
  store_id: string;
  name_tj: string;
  name_ru: string;
  description_tj: string | null;
  description_ru: string | null;
  category: string | null;
  price: number;
  unit: ProductUnit;
  stock: number | null;
  images: ProductImage[];
  is_available: boolean;
  sort_order: number;
  // Wholesale (Slice 2) — retail products keep is_wholesale=false, min_quantity=null
  is_wholesale: boolean;
  min_quantity: number | null;
  // Gifts (Stage B) — only set for products in a 'gifts' vertical store.
  // `category` carries the gift TYPE; `gift_contents` describes what's inside.
  gift_contents: string | null;
}

// Gift-order options collected on the gift detail page and carried through
// checkout to the order. Null/absent for retail and parcel orders.
export interface GiftOptions {
  recipient_name: string;
  gift_message: string;
  scheduled_date: string | null; // ISO date (yyyy-mm-dd) or null
}

// =====================================================================
// Settlement & payouts (mirrors 0024_settlement.sql)
// =====================================================================

export type PayoutStatus = 'pending' | 'paid' | 'void';

// One recorded payout to a store. Colibri pays externally; this row is the
// book entry, not an automated transfer.
export interface Payout {
  id: string;
  store_id: string;
  amount: number;          // Σ storeEarning settled in this payout
  order_count: number;
  period_start: string | null;
  period_end: string | null;
  status: PayoutStatus;
  reference: string | null; // admin-entered bank transfer reference
  note: string | null;
  created_by: string | null;
  created_at: string;
  paid_at: string | null;
}

// Per-order settlement marking added to `orders` by 0024. An order is in at
// most one payout (settled in full, once).
export interface OrderSettlement {
  settled_at: string | null;
  payout_id: string | null;
}

// Cart items live client-side only (Zustand store) until checkout.
export interface CartItem {
  product_id: string;
  store_id: string;
  name: string; // localized snapshot
  price: number;
  unit: ProductUnit;
  quantity: number;
  image_url: string | null;
  // Wholesale line metadata (optional — absent/false on retail items)
  is_wholesale?: boolean;
  min_quantity?: number | null;
}
