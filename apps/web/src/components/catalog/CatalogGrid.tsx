'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { LayoutGrid, List, X } from 'lucide-react';
import { useState } from 'react';
import { Select } from '@kiroportal/ui';
import type { Product, SortOption } from '@kiroportal/types';
import { ProductCard } from './ProductCard';

interface CatalogGridProps {
  products: Product[];
  totalCount: number;
}

const sortOptions = [
  { value: 'newest', label: 'Новинки' },
  { value: 'popular', label: 'Популярные' },
  { value: 'price_asc', label: 'Цена ↑' },
  { value: 'price_desc', label: 'Цена ↓' },
];

const filterLabels: Record<string, string> = {
  condition: 'Состояние',
  brand: 'Бренд',
  cpuFamily: 'CPU',
  cpuSocket: 'Сокет',
  ramType: 'Тип RAM',
  storageType: 'Тип диска',
  formFactor: 'Форм-фактор',
  stockStatus: 'Наличие',
  hotSwap: 'Hot-Swap',
};

export function CatalogGrid({ products, totalCount }: CatalogGridProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const currentSort = (searchParams.get('sort') as SortOption) || 'newest';

  // Collect active filters from URL params for display as tags
  const activeFilters: { key: string; value: string; label: string }[] = [];
  searchParams.forEach((value, key) => {
    if (key === 'sort' || key === 'cursor' || key === 'limit' || key === 'direction') return;
    if (filterLabels[key]) {
      // Multi-value filters are comma-separated
      value.split(',').forEach((v) => {
        activeFilters.push({ key, value: v, label: `${filterLabels[key]}: ${v}` });
      });
    }
  });

  function updateSearchParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null) {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    // Reset cursor when changing filters/sort
    params.delete('cursor');
    router.push(`${pathname}?${params.toString()}`);
  }

  function removeFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    const current = params.get(key);
    if (!current) return;

    const values = current.split(',').filter((v) => v !== value);
    if (values.length === 0) {
      params.delete(key);
    } else {
      params.set(key, values.join(','));
    }
    params.delete('cursor');
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSortChange(e: React.ChangeEvent<HTMLSelectElement>) {
    updateSearchParam('sort', e.target.value || null);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Results count */}
        <p className="text-sm text-text-secondary">
          Найдено: <span className="font-medium text-text-primary">{totalCount}</span> товаров
        </p>

        <div className="flex items-center gap-3">
          {/* Sort */}
          <div className="w-40">
            <Select
              options={sortOptions}
              value={currentSort}
              onChange={handleSortChange}
              aria-label="Сортировка"
            />
          </div>

          {/* View toggle */}
          <div className="flex items-center rounded-md border border-border-primary">
            <button
              onClick={() => setViewMode('grid')}
              className={[
                'flex h-8 w-8 items-center justify-center rounded-l-md transition-colors',
                viewMode === 'grid'
                  ? 'bg-accent-primary/10 text-accent-primary'
                  : 'text-text-secondary hover:bg-surface-tertiary',
              ].join(' ')}
              aria-label="Сетка"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={[
                'flex h-8 w-8 items-center justify-center rounded-r-md transition-colors',
                viewMode === 'list'
                  ? 'bg-accent-primary/10 text-accent-primary'
                  : 'text-text-secondary hover:bg-surface-tertiary',
              ].join(' ')}
              aria-label="Список"
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Active filter tags */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {activeFilters.map((filter) => (
            <button
              key={`${filter.key}-${filter.value}`}
              onClick={() => removeFilter(filter.key, filter.value)}
              className="inline-flex items-center gap-1 rounded-full border border-border-primary bg-surface-tertiary px-2.5 py-1 text-xs text-text-secondary hover:border-status-error/50 hover:text-status-error transition-colors"
            >
              {filter.label}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      )}

      {/* Product grid */}
      {products.length > 0 ? (
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'
              : 'flex flex-col gap-4'
          }
        >
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg font-medium text-text-primary">Товары не найдены</p>
          <p className="mt-1 text-sm text-text-secondary">
            Попробуйте изменить параметры фильтрации
          </p>
        </div>
      )}
    </div>
  );
}
