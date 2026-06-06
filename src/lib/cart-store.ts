'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { CartItem, Product, ProductUnit } from './types';

// Delivery pricing constants — kept here for now, will move to backend config later.
export const DELIVERY_BASE_FEE = 15;
export const FREE_DELIVERY_THRESHOLD = 150;

interface CartState {
  items: CartItem[];
  storeId: string | null;
  isOpen: boolean;
  _hasHydrated: boolean;

  // Actions
  addItem: (product: Pick<Product, 'id' | 'store_id' | 'price' | 'unit' | 'images'> & { name: string }) => void;
  removeItem: (productId: string) => void;
  setQuantity: (productId: string, quantity: number) => void;
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
      _setHasHydrated: (v) => set({ _hasHydrated: v }),

      addItem: (product) => {
        const items = get().items;
        const existing = items.find((i) => i.product_id === product.id);

        // If from a different store, replace cart (single-store cart for v1)
        if (get().storeId && get().storeId !== product.store_id) {
          set({
            items: [
              {
                product_id: product.id,
                store_id: product.store_id,
                name: product.name,
                price: product.price,
                unit: product.unit,
                quantity: 1,
                image_url: product.images?.[0]?.url ?? null,
              },
            ],
            storeId: product.store_id,
          });
          return;
        }

        if (existing) {
          set({
            items: items.map((i) =>
              i.product_id === product.id
                ? { ...i, quantity: roundQty(i.quantity + 1, product.unit) }
                : i,
            ),
          });
        } else {
          set({
            items: [
              ...items,
              {
                product_id: product.id,
                store_id: product.store_id,
                name: product.name,
                price: product.price,
                unit: product.unit,
                quantity: 1,
                image_url: product.images?.[0]?.url ?? null,
              },
            ],
            storeId: product.store_id,
          });
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
          items: get().items.map((i) =>
            i.product_id === productId ? { ...i, quantity } : i,
          ),
        });
      },

      clear: () => set({ items: [], storeId: null }),
      openDrawer: () => set({ isOpen: true }),
      closeDrawer: () => set({ isOpen: false }),
      toggleDrawer: () => set({ isOpen: !get().isOpen }),
    }),
    {
      name: 'colibri-cart',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ items: state.items, storeId: state.storeId }),
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
  if (unit === 'kg' || unit === 'gram') return Math.round(n * 2) / 2;
  return Math.round(n);
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
