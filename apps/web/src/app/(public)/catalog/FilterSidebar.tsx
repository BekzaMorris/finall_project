'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Badge } from '@kiroportal/ui';
import { Condition, StockStatus } from '@kiroportal/types';

const conditionOptions = [
  { value: Condition.NEW, label: 'Новый' },
  { value: Condition.USED, label: 'Б/У' },
  { value: Condition.REFURBISHED, label: 'Восстановленный' },
];

const stockOptions = [
  { value: StockStatus.IN_STOCK, label: 'В наличии' },
  { value: StockStatus.LOW_STOCK, label: 'Мало' },
  { value: StockStatus.PRE_ORDER, label: 'Под заказ' },
];

export function FilterSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function toggleFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    const current = params.get(key)?.split(',').filter(Boolean) || [];

    if (current.includes(value)) {
      const updated = current.filter((v) => v !== value);
      if (updated.length === 0) {
        params.delete(key);
      } else {
        params.set(key, updated.join(','));
      }
    } else {
      params.set(key, [...current, value].join(','));
    }

    params.delete('cursor');
    router.push(`${pathname}?${params.toString()}`);
  }

  function isActive(key: string, value: string): boolean {
    const current = searchParams.get(key)?.split(',') || [];
    return current.includes(value);
  }

  function clearAllFilters() {
    router.push(pathname);
  }

  const hasFilters = Array.from(searchParams.entries()).some(
    ([key]) => !['sort', 'cursor', 'limit', 'direction'].includes(key),
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wide">
          Фильтры
        </h2>
        {hasFilters && (
          <button
            onClick={clearAllFilters}
            className="text-xs text-accent-primary hover:text-accent-primary/80 transition-colors"
          >
            Сбросить
          </button>
        )}
      </div>

      {/* Condition filter */}
      <FilterSection title="Состояние">
        <div className="flex flex-col gap-2">
          {conditionOptions.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2 cursor-pointer text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              <input
                type="checkbox"
                checked={isActive('condition', option.value)}
                onChange={() => toggleFilter('condition', option.value)}
                className="h-4 w-4 rounded border-border-primary bg-surface-tertiary text-accent-primary focus:ring-accent-primary"
              />
              {option.label}
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Stock status filter */}
      <FilterSection title="Наличие">
        <div className="flex flex-col gap-2">
          {stockOptions.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2 cursor-pointer text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              <input
                type="checkbox"
                checked={isActive('stockStatus', option.value)}
                onChange={() => toggleFilter('stockStatus', option.value)}
                className="h-4 w-4 rounded border-border-primary bg-surface-tertiary text-accent-primary focus:ring-accent-primary"
              />
              {option.label}
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Placeholder for additional filters (task 19.2) */}
      <div className="border-t border-border-primary pt-4">
        <p className="text-xs text-text-tertiary">
          Дополнительные фильтры: CPU, RAM, хранилище, цена, бренд
        </p>
      </div>
    </div>
  );
}

function FilterSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-sm font-medium text-text-primary">{title}</h3>
      {children}
    </div>
  );
}
