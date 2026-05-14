'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronDown,
  ChevronRight,
  X,
  SlidersHorizontal,
  RotateCcw,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { ProductFilters } from '@kiroportal/types';
import { Condition, StockStatus } from '@kiroportal/types';

// ─── Constants ───────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 300;

const CONDITION_LABELS: Record<string, string> = {
  [Condition.NEW]: 'Новый',
  [Condition.USED]: 'Б/У',
  [Condition.REFURBISHED]: 'Восстановленный',
};

const STOCK_STATUS_LABELS: Record<string, string> = {
  [StockStatus.IN_STOCK]: 'В наличии',
  [StockStatus.LOW_STOCK]: 'Мало',
  [StockStatus.PRE_ORDER]: 'Под заказ',
};

const BRAND_OPTIONS = ['Dell', 'HP', 'Supermicro', 'Lenovo', 'Cisco', 'Fujitsu'];

const FORM_FACTOR_OPTIONS = ['Rack', 'Tower', 'Blade'];

const STORAGE_TYPE_OPTIONS = ['SSD', 'HDD', 'NVMe'];

const RAM_TYPE_OPTIONS = ['DDR4', 'DDR5'];

// ─── URL Parsing Helpers ─────────────────────────────────────────────────────

function parseArrayParam(value: string | null): string[] {
  if (!value) return [];
  return value.split(',').filter(Boolean);
}

function parseRangeParam(value: string | null): { min?: number; max?: number } | undefined {
  if (!value) return undefined;
  const parts = value.split('-');
  if (parts.length !== 2) return undefined;
  const min = parts[0] ? Number(parts[0]) : undefined;
  const max = parts[1] ? Number(parts[1]) : undefined;
  if ((min !== undefined && isNaN(min)) || (max !== undefined && isNaN(max))) return undefined;
  return { min, max };
}

function parseBooleanParam(value: string | null): boolean | undefined {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return undefined;
}

function filtersFromSearchParams(params: URLSearchParams): ProductFilters {
  const filters: ProductFilters = {};

  const condition = parseArrayParam(params.get('condition'));
  if (condition.length) filters.condition = condition as Condition[];

  const brand = parseArrayParam(params.get('brand'));
  if (brand.length) filters.brand = brand;

  const cpuCores = parseRangeParam(params.get('cpuCores'));
  if (cpuCores) filters.cpuCores = cpuCores;

  const cpuFamily = parseArrayParam(params.get('cpuFamily'));
  if (cpuFamily.length) filters.cpuFamily = cpuFamily;

  const cpuCount = parseArrayParam(params.get('cpuCount'));
  if (cpuCount.length) filters.cpuCount = cpuCount.map(Number).filter((n) => !isNaN(n));

  const ramGb = parseRangeParam(params.get('ramGb'));
  if (ramGb) filters.ramGb = ramGb;

  const ramType = parseArrayParam(params.get('ramType'));
  if (ramType.length) filters.ramType = ramType;

  const storageType = parseArrayParam(params.get('storageType'));
  if (storageType.length) filters.storageType = storageType;

  const storageSize = parseRangeParam(params.get('storageSize'));
  if (storageSize) filters.storageSize = storageSize;

  const hotSwap = parseBooleanParam(params.get('hotSwap'));
  if (hotSwap !== undefined) filters.hotSwap = hotSwap;

  const formFactor = parseArrayParam(params.get('formFactor'));
  if (formFactor.length) filters.formFactor = formFactor;

  const priceRange = parseRangeParam(params.get('price'));
  if (priceRange) filters.priceRange = priceRange;

  const stockStatus = parseArrayParam(params.get('stockStatus'));
  if (stockStatus.length) filters.stockStatus = stockStatus as StockStatus[];

  return filters;
}

function filtersToSearchParams(filters: ProductFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.condition?.length) params.set('condition', filters.condition.join(','));
  if (filters.brand?.length) params.set('brand', filters.brand.join(','));
  if (filters.cpuCores) {
    params.set('cpuCores', `${filters.cpuCores.min ?? ''}-${filters.cpuCores.max ?? ''}`);
  }
  if (filters.cpuFamily?.length) params.set('cpuFamily', filters.cpuFamily.join(','));
  if (filters.cpuCount?.length) params.set('cpuCount', filters.cpuCount.join(','));
  if (filters.ramGb) {
    params.set('ramGb', `${filters.ramGb.min ?? ''}-${filters.ramGb.max ?? ''}`);
  }
  if (filters.ramType?.length) params.set('ramType', filters.ramType.join(','));
  if (filters.storageType?.length) params.set('storageType', filters.storageType.join(','));
  if (filters.storageSize) {
    params.set('storageSize', `${filters.storageSize.min ?? ''}-${filters.storageSize.max ?? ''}`);
  }
  if (filters.hotSwap !== undefined) params.set('hotSwap', String(filters.hotSwap));
  if (filters.formFactor?.length) params.set('formFactor', filters.formFactor.join(','));
  if (filters.priceRange) {
    params.set('price', `${filters.priceRange.min ?? ''}-${filters.priceRange.max ?? ''}`);
  }
  if (filters.stockStatus?.length) params.set('stockStatus', filters.stockStatus.join(','));

  return params;
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface FilterSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function FilterSection({ title, defaultOpen = false, children }: FilterSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border-secondary py-3">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between text-sm font-medium text-text-primary hover:text-accent-primary transition-colors"
        aria-expanded={isOpen}
      >
        <span>{title}</span>
        {isOpen ? (
          <ChevronDown className="h-4 w-4 text-text-tertiary" />
        ) : (
          <ChevronRight className="h-4 w-4 text-text-tertiary" />
        )}
      </button>
      {isOpen && <div className="mt-3 space-y-2">{children}</div>}
    </div>
  );
}

interface CheckboxFilterProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function CheckboxFilter({ label, checked, onChange }: CheckboxFilterProps) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-border-primary bg-surface-secondary text-accent-primary focus:ring-accent-primary focus:ring-offset-0"
      />
      <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
        {label}
      </span>
    </label>
  );
}

interface RangeInputProps {
  label: string;
  min?: number;
  max?: number;
  onMinChange: (value: number | undefined) => void;
  onMaxChange: (value: number | undefined) => void;
  placeholderMin?: string;
  placeholderMax?: string;
}

function RangeInput({
  label,
  min,
  max,
  onMinChange,
  onMaxChange,
  placeholderMin = 'от',
  placeholderMax = 'до',
}: RangeInputProps) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs text-text-tertiary">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={min ?? ''}
          onChange={(e) => onMinChange(e.target.value ? Number(e.target.value) : undefined)}
          placeholder={placeholderMin}
          className="w-full rounded-md border border-border-primary bg-surface-secondary px-2 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent-primary"
          aria-label={`${label} минимум`}
        />
        <span className="text-text-tertiary text-xs">—</span>
        <input
          type="number"
          value={max ?? ''}
          onChange={(e) => onMaxChange(e.target.value ? Number(e.target.value) : undefined)}
          placeholder={placeholderMax}
          className="w-full rounded-md border border-border-primary bg-surface-secondary px-2 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-1 focus:ring-accent-primary"
          aria-label={`${label} максимум`}
        />
      </div>
    </div>
  );
}

interface ToggleFilterProps {
  label: string;
  checked: boolean | undefined;
  onChange: (value: boolean | undefined) => void;
}

function ToggleFilter({ label, checked, onChange }: ToggleFilterProps) {
  return (
    <label className="flex items-center justify-between cursor-pointer group">
      <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
        {label}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked ?? false}
        onClick={() => onChange(checked ? undefined : true)}
        className={[
          'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
          checked ? 'bg-accent-primary' : 'bg-surface-tertiary border border-border-primary',
        ].join(' ')}
      >
        <span
          className={[
            'inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform',
            checked ? 'translate-x-4.5' : 'translate-x-0.5',
          ].join(' ')}
        />
      </button>
    </label>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export interface FilterSidebarProps {
  className?: string;
}

export function FilterSidebar({ className = '' }: FilterSidebarProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Parse initial filters from URL
  const [filters, setFilters] = useState<ProductFilters>(() =>
    filtersFromSearchParams(searchParams),
  );

  // Keep filters in sync when URL changes externally
  const prevSearchParamsRef = useRef(searchParams.toString());
  useEffect(() => {
    const currentStr = searchParams.toString();
    if (currentStr !== prevSearchParamsRef.current) {
      prevSearchParamsRef.current = currentStr;
      setFilters(filtersFromSearchParams(searchParams));
    }
  }, [searchParams]);

  // Debounced filters for count query
  const debouncedFilters = useDebounce(filters, DEBOUNCE_MS);

  // Fetch count with debounced filters
  const countQueryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (debouncedFilters.condition?.length)
      params.set('condition', debouncedFilters.condition.join(','));
    if (debouncedFilters.brand?.length)
      params.set('brand', debouncedFilters.brand.join(','));
    if (debouncedFilters.cpuCores) {
      if (debouncedFilters.cpuCores.min !== undefined)
        params.set('cpuCoresMin', String(debouncedFilters.cpuCores.min));
      if (debouncedFilters.cpuCores.max !== undefined)
        params.set('cpuCoresMax', String(debouncedFilters.cpuCores.max));
    }
    if (debouncedFilters.cpuFamily?.length)
      params.set('cpuFamily', debouncedFilters.cpuFamily.join(','));
    if (debouncedFilters.ramGb) {
      if (debouncedFilters.ramGb.min !== undefined)
        params.set('ramGbMin', String(debouncedFilters.ramGb.min));
      if (debouncedFilters.ramGb.max !== undefined)
        params.set('ramGbMax', String(debouncedFilters.ramGb.max));
    }
    if (debouncedFilters.ramType?.length)
      params.set('ramType', debouncedFilters.ramType.join(','));
    if (debouncedFilters.storageType?.length)
      params.set('storageType', debouncedFilters.storageType.join(','));
    if (debouncedFilters.storageSize) {
      if (debouncedFilters.storageSize.min !== undefined)
        params.set('storageSizeMin', String(debouncedFilters.storageSize.min));
      if (debouncedFilters.storageSize.max !== undefined)
        params.set('storageSizeMax', String(debouncedFilters.storageSize.max));
    }
    if (debouncedFilters.hotSwap !== undefined)
      params.set('hotSwap', String(debouncedFilters.hotSwap));
    if (debouncedFilters.formFactor?.length)
      params.set('formFactor', debouncedFilters.formFactor.join(','));
    if (debouncedFilters.priceRange) {
      if (debouncedFilters.priceRange.min !== undefined)
        params.set('priceMin', String(debouncedFilters.priceRange.min));
      if (debouncedFilters.priceRange.max !== undefined)
        params.set('priceMax', String(debouncedFilters.priceRange.max));
    }
    if (debouncedFilters.stockStatus?.length)
      params.set('stockStatus', debouncedFilters.stockStatus.join(','));
    return params.toString();
  }, [debouncedFilters]);

  const { data: countData } = useQuery({
    queryKey: ['products', 'count', countQueryParams],
    queryFn: () =>
      apiClient<{ count: number }>(
        `/products/count${countQueryParams ? `?${countQueryParams}` : ''}`,
      ),
    placeholderData: (prev) => prev,
  });

  // Update URL when filters change
  const updateUrl = useCallback(
    (newFilters: ProductFilters) => {
      const params = filtersToSearchParams(newFilters);
      const queryString = params.toString();
      const newUrl = queryString ? `${pathname}?${queryString}` : pathname;
      prevSearchParamsRef.current = queryString;
      router.push(newUrl, { scroll: false });
    },
    [pathname, router],
  );

  // Update filters and URL
  const updateFilters = useCallback(
    (updater: (prev: ProductFilters) => ProductFilters) => {
      setFilters((prev) => {
        const next = updater(prev);
        updateUrl(next);
        return next;
      });
    },
    [updateUrl],
  );

  // Reset all filters
  const resetFilters = useCallback(() => {
    setFilters({});
    router.push(pathname, { scroll: false });
    prevSearchParamsRef.current = '';
  }, [pathname, router]);

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some((v) => {
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'object' && v !== null) return v.min !== undefined || v.max !== undefined;
      return v !== undefined;
    });
  }, [filters]);

  // ─── Filter update helpers ─────────────────────────────────────────────────

  const toggleArrayFilter = useCallback(
    (key: keyof ProductFilters, value: string) => {
      updateFilters((prev) => {
        const current = (prev[key] as string[] | undefined) ?? [];
        const next = current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value];
        return { ...prev, [key]: next.length ? next : undefined };
      });
    },
    [updateFilters],
  );

  const setRangeFilter = useCallback(
    (key: keyof ProductFilters, field: 'min' | 'max', value: number | undefined) => {
      updateFilters((prev) => {
        const current = (prev[key] as { min?: number; max?: number } | undefined) ?? {};
        const next = { ...current, [field]: value };
        if (next.min === undefined && next.max === undefined) {
          const { [key]: _, ...rest } = prev;
          return rest as ProductFilters;
        }
        return { ...prev, [key]: next };
      });
    },
    [updateFilters],
  );

  // ─── Render filter content ─────────────────────────────────────────────────

  const filterContent = (
    <div className="space-y-0">
      {/* Count display */}
      <div className="pb-3 border-b border-border-secondary">
        <p className="text-sm text-text-secondary">
          Найдено:{' '}
          <span className="font-medium text-text-primary">
            {countData?.count ?? '—'} серверов
          </span>
        </p>
      </div>

      {/* Reset button */}
      {hasActiveFilters && (
        <div className="py-3 border-b border-border-secondary">
          <button
            type="button"
            onClick={resetFilters}
            className="flex items-center gap-1.5 text-sm text-accent-primary hover:text-accent-secondary transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Сбросить все
          </button>
        </div>
      )}

      {/* Condition */}
      <FilterSection title="Состояние" defaultOpen>
        {Object.entries(CONDITION_LABELS).map(([value, label]) => (
          <CheckboxFilter
            key={value}
            label={label}
            checked={filters.condition?.includes(value as Condition) ?? false}
            onChange={() => toggleArrayFilter('condition', value)}
          />
        ))}
      </FilterSection>

      {/* Brand */}
      <FilterSection title="Бренд" defaultOpen>
        {BRAND_OPTIONS.map((brand) => (
          <CheckboxFilter
            key={brand}
            label={brand}
            checked={filters.brand?.includes(brand) ?? false}
            onChange={() => toggleArrayFilter('brand', brand)}
          />
        ))}
      </FilterSection>

      {/* CPU */}
      <FilterSection title="Процессор">
        <RangeInput
          label="Ядра"
          min={filters.cpuCores?.min}
          max={filters.cpuCores?.max}
          onMinChange={(v) => setRangeFilter('cpuCores', 'min', v)}
          onMaxChange={(v) => setRangeFilter('cpuCores', 'max', v)}
          placeholderMin="от 1"
          placeholderMax="до 128"
        />
        <RangeInput
          label="Количество процессоров"
          min={filters.cpuCount?.length ? filters.cpuCount[0] : undefined}
          max={filters.cpuCount?.length ? filters.cpuCount[filters.cpuCount.length - 1] : undefined}
          onMinChange={(v) =>
            updateFilters((prev) => ({
              ...prev,
              cpuCount: v !== undefined ? [v] : undefined,
            }))
          }
          onMaxChange={(v) =>
            updateFilters((prev) => {
              const min = prev.cpuCount?.[0];
              if (v !== undefined && min !== undefined) {
                return { ...prev, cpuCount: [min, v] };
              }
              return prev;
            })
          }
          placeholderMin="от 1"
          placeholderMax="до 8"
        />
      </FilterSection>

      {/* RAM */}
      <FilterSection title="Память">
        <RangeInput
          label="Объём (ГБ)"
          min={filters.ramGb?.min}
          max={filters.ramGb?.max}
          onMinChange={(v) => setRangeFilter('ramGb', 'min', v)}
          onMaxChange={(v) => setRangeFilter('ramGb', 'max', v)}
          placeholderMin="от 8"
          placeholderMax="до 2048"
        />
        <div className="space-y-1.5">
          <span className="text-xs text-text-tertiary">Тип</span>
          <div className="space-y-2">
            {RAM_TYPE_OPTIONS.map((type) => (
              <CheckboxFilter
                key={type}
                label={type}
                checked={filters.ramType?.includes(type) ?? false}
                onChange={() => toggleArrayFilter('ramType', type)}
              />
            ))}
          </div>
        </div>
      </FilterSection>

      {/* Storage */}
      <FilterSection title="Хранилище">
        <div className="space-y-1.5">
          <span className="text-xs text-text-tertiary">Тип</span>
          <div className="space-y-2">
            {STORAGE_TYPE_OPTIONS.map((type) => (
              <CheckboxFilter
                key={type}
                label={type}
                checked={filters.storageType?.includes(type) ?? false}
                onChange={() => toggleArrayFilter('storageType', type)}
              />
            ))}
          </div>
        </div>
        <RangeInput
          label="Объём (ГБ)"
          min={filters.storageSize?.min}
          max={filters.storageSize?.max}
          onMinChange={(v) => setRangeFilter('storageSize', 'min', v)}
          onMaxChange={(v) => setRangeFilter('storageSize', 'max', v)}
          placeholderMin="от 240"
          placeholderMax="до 30720"
        />
        <ToggleFilter
          label="Hot-Swap"
          checked={filters.hotSwap}
          onChange={(v) =>
            updateFilters((prev) => ({ ...prev, hotSwap: v }))
          }
        />
      </FilterSection>

      {/* Form Factor */}
      <FilterSection title="Форм-фактор">
        {FORM_FACTOR_OPTIONS.map((ff) => (
          <CheckboxFilter
            key={ff}
            label={ff}
            checked={filters.formFactor?.includes(ff) ?? false}
            onChange={() => toggleArrayFilter('formFactor', ff)}
          />
        ))}
      </FilterSection>

      {/* Price */}
      <FilterSection title="Цена" defaultOpen>
        <RangeInput
          label="Диапазон (₽)"
          min={filters.priceRange?.min}
          max={filters.priceRange?.max}
          onMinChange={(v) => setRangeFilter('priceRange', 'min', v)}
          onMaxChange={(v) => setRangeFilter('priceRange', 'max', v)}
          placeholderMin="от"
          placeholderMax="до"
        />
      </FilterSection>

      {/* Stock Status */}
      <FilterSection title="Наличие" defaultOpen>
        {Object.entries(STOCK_STATUS_LABELS).map(([value, label]) => (
          <CheckboxFilter
            key={value}
            label={label}
            checked={filters.stockStatus?.includes(value as StockStatus) ?? false}
            onChange={() => toggleArrayFilter('stockStatus', value)}
          />
        ))}
      </FilterSection>
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className={[
          'hidden lg:block w-64 shrink-0 overflow-y-auto rounded-lg border border-border-primary bg-surface-secondary p-4',
          className,
        ].join(' ')}
      >
        <h2 className="text-base font-semibold text-text-primary mb-3 flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          Фильтры
        </h2>
        {filterContent}
      </aside>

      {/* Mobile trigger button */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent-primary text-white shadow-lg hover:bg-accent-primary/90 transition-colors lg:hidden"
        aria-label="Открыть фильтры"
      >
        <SlidersHorizontal className="h-5 w-5" />
      </button>

      {/* Mobile bottom sheet drawer */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-50 bg-black/50 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <div className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-border-primary bg-surface-secondary p-4 pb-8 lg:hidden animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                Фильтры
              </h2>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-surface-tertiary hover:text-text-primary transition-colors"
                aria-label="Закрыть фильтры"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Drag handle indicator */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-border-primary" />
            {filterContent}
            {/* Apply button for mobile */}
            <div className="sticky bottom-0 pt-4 mt-4 border-t border-border-secondary bg-surface-secondary">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="w-full rounded-md bg-accent-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-primary/90 transition-colors"
              >
                Показать {countData?.count ?? '—'} серверов
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
