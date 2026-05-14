import { Condition, StockStatus } from './enums';

// ─── Catalog Filter and Pagination Types ─────────────────────────────────────

export interface RangeFilter {
  min?: number;
  max?: number;
}

export interface ProductFilters {
  condition?: Condition[];
  cpuFamily?: string[];
  cpuCores?: RangeFilter;
  cpuCount?: number[];
  cpuFrequency?: RangeFilter;
  cpuSocket?: string[];
  ramGb?: RangeFilter;
  ramType?: string[];
  ramFrequency?: RangeFilter;
  ramSlots?: number[];
  storageType?: string[];
  storageSize?: RangeFilter;
  hotSwap?: boolean;
  formFactor?: string[];
  units?: number[];
  psuWattage?: RangeFilter;
  priceRange?: RangeFilter;
  brand?: string[];
  stockStatus?: StockStatus[];
  sort?: SortOption;
}

export type SortOption = 'price_asc' | 'price_desc' | 'newest' | 'popular';

export interface CursorPagination {
  cursor?: string;
  limit: number;
  direction: 'forward' | 'backward';
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  prevCursor: string | null;
  totalCount: number;
}
