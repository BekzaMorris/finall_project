import type { ProductFilters, CursorPagination, PaginatedResult } from '@kiroportal/types';
import {
  generateCacheKey,
  getFromCache,
  setInCache,
  invalidateByPattern,
} from '../lib/cache.js';
import {
  getProducts,
  getFilterOptions,
  getProductCount,
  type FilterOptions,
} from './catalog.service.js';

// ─── TTL Constants ───────────────────────────────────────────────────────────

/** Product listings cache TTL: 10 minutes */
const PRODUCTS_TTL_SECONDS = 10 * 60;

/** Filter options cache TTL: 1 hour */
const FILTERS_TTL_SECONDS = 60 * 60;

// ─── Cache Key Prefixes ──────────────────────────────────────────────────────

const PRODUCTS_LIST_PREFIX = 'products:list';
const PRODUCTS_COUNT_PREFIX = 'products:count';
const PRODUCTS_FILTERS_KEY = 'products:filters';

// ─── Cached Catalog Service ──────────────────────────────────────────────────

/**
 * Get products with Redis caching (10min TTL).
 * Falls back to direct DB query on cache miss or Redis unavailability.
 */
export async function getCachedProducts(
  filters: ProductFilters,
  pagination: CursorPagination,
): Promise<PaginatedResult<Record<string, unknown>>> {
  const cacheKey = generateCacheKey(PRODUCTS_LIST_PREFIX, {
    filters,
    pagination,
  });

  // Try cache first
  const cached = await getFromCache<PaginatedResult<Record<string, unknown>>>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  // Cache miss: query DB
  const result = await getProducts(filters, pagination);

  // Store in cache (fire and forget)
  await setInCache(cacheKey, result, PRODUCTS_TTL_SECONDS);

  return result;
}

/**
 * Get filter options with Redis caching (1hr TTL).
 * Falls back to direct DB query on cache miss or Redis unavailability.
 */
export async function getCachedFilterOptions(): Promise<FilterOptions> {
  // Use a fixed key since filter options don't depend on parameters
  const cacheKey = PRODUCTS_FILTERS_KEY;

  // Try cache first
  const cached = await getFromCache<FilterOptions>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  // Cache miss: query DB
  const result = await getFilterOptions();

  // Store in cache (fire and forget)
  await setInCache(cacheKey, result, FILTERS_TTL_SECONDS);

  return result;
}

/**
 * Get product count with Redis caching (10min TTL).
 * Falls back to direct DB query on cache miss or Redis unavailability.
 */
export async function getCachedProductCount(
  filters: ProductFilters,
): Promise<number> {
  const cacheKey = generateCacheKey(PRODUCTS_COUNT_PREFIX, { filters });

  // Try cache first
  const cached = await getFromCache<number>(cacheKey);
  if (cached !== null) {
    return cached;
  }

  // Cache miss: query DB
  const result = await getProductCount(filters);

  // Store in cache (fire and forget)
  await setInCache(cacheKey, result, PRODUCTS_TTL_SECONDS);

  return result;
}

/**
 * Invalidate all product-related caches.
 * Called on product create, update, or delete.
 * Completes within 5 seconds per requirement 17.3.
 *
 * @param productId - Optional product ID (currently invalidates all product caches regardless)
 */
export async function invalidateProductCaches(productId?: string): Promise<void> {
  // Invalidate all product listing caches, count caches, and filter options
  // Whether a specific productId is provided or not, we invalidate broadly
  // because any product change can affect listings, counts, and filter options
  await Promise.all([
    invalidateByPattern(`${PRODUCTS_LIST_PREFIX}:*`),
    invalidateByPattern(`${PRODUCTS_COUNT_PREFIX}:*`),
    invalidateByPattern(PRODUCTS_FILTERS_KEY),
  ]);
}
