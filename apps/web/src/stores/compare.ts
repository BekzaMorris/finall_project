import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Product } from '@kiroportal/types';

const MAX_COMPARE_ITEMS = 4;

interface CompareState {
  items: Product[];
}

interface CompareActions {
  addToCompare: (product: Product) => { success: boolean; message?: string };
  removeFromCompare: (productId: string) => void;
  clearCompare: () => void;
  isInCompare: (productId: string) => boolean;
}

type CompareStore = CompareState & CompareActions;

export const useCompareStore = create<CompareStore>()(
  persist(
    (set, get) => ({
      items: [],

      addToCompare: (product) => {
        const { items } = get();

        if (items.length >= MAX_COMPARE_ITEMS) {
          return {
            success: false,
            message: `Максимум ${MAX_COMPARE_ITEMS} сервера для сравнения`,
          };
        }

        if (items.some((item) => item.id === product.id)) {
          return { success: true };
        }

        set({ items: [...items, product] });
        return { success: true };
      },

      removeFromCompare: (productId) => {
        const { items } = get();
        set({ items: items.filter((item) => item.id !== productId) });
      },

      clearCompare: () => {
        set({ items: [] });
      },

      isInCompare: (productId) => {
        return get().items.some((item) => item.id === productId);
      },
    }),
    {
      name: 'kiroportal-compare',
      partialize: (state) => ({
        items: state.items,
      }),
    },
  ),
);
