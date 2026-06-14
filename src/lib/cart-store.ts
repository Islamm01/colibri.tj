'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CartItem, GiftOptions, Product, ProductUnit } from './types';

// Delivery pricing constants — kept here for now, will move to backend config later.
export const DELIVERY_BASE_FEE = 15;
export const FREE_DELIVERY_THRESHOLD = 150;

interface CartState {
  items: CartItem[];
  storeId: string | null;
  isOpen: boolean;
  _hasHydrated: boolean;
  // Gift-order options (order-level). Set on the gift detail page; null for
  // retail/parcel carts. Cleared whenever the cart is cleared or switched.
  giftOptions: GiftOptions | null;

  // Actions
  addItem: (
    product: Pick<Product, 'id' | 'store_id' | 'price' | 'unit' | 'images' | 'is_wholesale' | 'min_quantity'> & {
      name: string;
    },
  ) => void;
  removeItem: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
  setGiftOptions: (gift: GiftOptions | null) => void;
  clear: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  _setHasHydrated: (v: boolean) => void;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      storeId: null,
      isOpen: false,
      _hasHydrated: false,
      giftOptions: null,
      _setHasHydrated: (v) => set({ _hasHydrated: v }),

      // TODO: future — separate wholesale checkout / quote flow.
      // For now wholesale and retail share one cart; wholesale lines are
      // flagged (is_wholesale) and shown with a label rather than split out.
      addItem: (product) => {
        const items = get().items;
        const existing = items.find((i) => i.product_id === product.id);

        const isWholesale = product.is_wholesale ?? false;
        const minQty = product.min_quantity ?? null;
        // Wholesale items start at their minimum order quantity; retail at 1.
        const initialQty = isWholesale && minQty && minQty > 0 ? minQty : 1;

        const newLine: CartItem = {
          product_id: product.id,
          store_id: product.store_id,
          name: product.name,
          price: product.price,
          unit: product.unit,
          quantity: initialQty,
          image_url: product.images?.[0]?.url ?? null,
          is_wholesale: isWholesale,
          min_quantity: minQty,
        };

        // If from a different store, replace cart (single-store cart for v1).
        // Gift options belong to the previous store's cart, so drop them too.
        if (get().storeId && get().storeId !== product.store_id) {
          set({ items: [newLine], storeId: product.store_id, giftOptions: null });
          return;
        }

        if (existing) {
          const step = isWholesale ? wholesaleStep(product.unit) : 1;
          set({
            items: items.map((i) =>
              i.product_id === product.id
                ? { ...i, quantity: roundQty(i.quantity + step, product.unit) }
                : i,
            ),
          });
        } else {
          set({ items: [...items, newLine], storeId: product.store_id });
        }
      },

      removeItem: (productId) => {
        const items = get().items.filter((i) => i.product_id !== productId);
        set({ items, storeId: items.length ? get().storeId : null });
      },

      setQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }
        set({
          items: get().items.map((i) => {
            if (i.product_id !== productId) return i;
            // Wholesale lines can never drop below their minimum order quantity
            // (use the remove button to clear them entirely).
            const floored =
              i.is_wholesale && i.min_quantity && quantity < i.min_quantity
                ? i.min_quantity
                : quantity;
            return { ...i, quantity: floored };
          }),
        });
      },

      setGiftOptions: (gift) => set({ giftOptions: gift }),

      clear: () => set({ items: [], storeId: null, giftOptions: null }),
      openDrawer: () => set({ isOpen: true }),
      closeDrawer: () => set({ isOpen: false }),
      toggleDrawer: () => set({ isOpen: !get().isOpen }),
    }),
    {
      name: 'colibri-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items, storeId: state.storeId, giftOptions: state.giftOptions }),
      onRehydrateStorage: () => {
        // Returns a callback that runs after hydration attempts —
        // whether or not anything was actually loaded from localStorage.
        return () => {
          // Use setState on the hook itself to ensure the flag flips
          // even when there's nothing in localStorage (new visitor).
          useCart.setState({ _hasHydrated: true });
        };
      },
    },
  ),
);

// Safety net: in case onRehydrateStorage doesn't fire for any reason (e.g. SSR edge cases),
// mark as hydrated on the next tick. Without this, the loading spinner could stick forever.
if (typeof window !== 'undefined') {
  setTimeout(() => {
    if (!useCart.getState()._hasHydrated) {
      useCart.setState({ _hasHydrated: true });
    }
  }, 100);
}

function roundQty(n: number, unit: ProductUnit): number {
  // For weight units we allow 0.5 increments; for piece/pack we keep integers.
  if (unit === 'kg' || unit === 'gram' || unit === 'ton') return Math.round(n * 2) / 2;
  return Math.round(n);
}

// Sensible bump size when an already-added wholesale line is added again.
// Bulk weights step in larger chunks than the retail 0.5 kg.
export function wholesaleStep(unit: ProductUnit): number {
  switch (unit) {
    case 'ton': return 1;
    case 'kg': return 10;
    case 'gram': return 100;
    default: return 1; // piece / pack
  }
}

// =====================================================================
// Selectors
// =====================================================================

export function selectSubtotal(state: CartState): number {
  return state.items.reduce((acc, i) => acc + i.price * i.quantity, 0);
}

export function selectItemCount(state: CartState): number {
  return state.items.reduce((acc, i) => acc + (i.unit === 'piece' || i.unit === 'pack' ? i.quantity : 1), 0);
}

export function selectDeliveryFee(state: CartState): number {
  const subtotal = selectSubtotal(state);
  if (subtotal >= FREE_DELIVERY_THRESHOLD) return 0;
  return DELIVERY_BASE_FEE;
}

export function selectTotal(state: CartState): number {
  return selectSubtotal(state) + selectDeliveryFee(state);
}

export function selectAmountToFreeDelivery(state: CartState): number {
  const subtotal = selectSubtotal(state);
  return Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal);
}
