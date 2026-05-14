import { create } from 'zustand';
import { apiClient } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CartProduct {
  name: string;
  slug: string;
  price: number;
  stockStatus: string;
  images: Array<{ url: string; alt: string | null }>;
}

export interface CartItemWithProduct {
  id: string;
  productId: string;
  quantity: number;
  createdAt: string;
  product: CartProduct;
}

export interface CartSummary {
  items: CartItemWithProduct[];
  totalItems: number;
}

interface CartState {
  items: CartItemWithProduct[];
  totalItems: number;
  isLoading: boolean;
  error: string | null;
}

interface CartActions {
  fetchCart: () => Promise<void>;
  clearCart: () => void;
}

type CartStore = CartState & CartActions;

// ─── Cart Store ──────────────────────────────────────────────────────────────

export const useCartStore = create<CartStore>((set) => ({
  items: [],
  totalItems: 0,
  isLoading: false,
  error: null,

  fetchCart: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await apiClient<CartSummary>('/cart');
      set({
        items: data.items,
        totalItems: data.totalItems,
        isLoading: false,
      });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to load cart',
        isLoading: false,
      });
    }
  },

  clearCart: () => {
    set({ items: [], totalItems: 0 });
  },
}));
