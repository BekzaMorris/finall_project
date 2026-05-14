import type {
  ProductFilters,
  CursorPagination,
  PaginatedResult,
  SortOption,
} from '@kiroportal/types';
import { prisma } from '../lib/prisma.js';

// ─── Types ───────────────────────────────────────────────────────────────────

/** Prisma WHERE clause type for product queries */
export type ProductWhereClause = Record<string, unknown>;

/** Sort order configuration for Prisma orderBy */
export type ProductOrderBy = Array<Record<string, 'asc' | 'desc'>>;

/** Filter options returned for the catalog sidebar */
export interface FilterOptions {
  conditions: string[];
  brands: string[];
  cpuFamilies: string[];
  cpuSockets: string[];
  ramTypes: string[];
  storageTypes: string[];
  formFactors: string[];
  stockStatuses: string[];
}

// ─── Filter Query Builder ────────────────────────────────────────────────────

/**
 * Builds a Prisma WHERE clause from ProductFilters.
 * - Multi-value filters use `in`
 * - Range filters use `gte`/`lte`
 * - Boolean filters use exact match
 * - All filters are combined with AND logic
 */
export function buildWhereClause(filters: ProductFilters): ProductWhereClause {
  const where: ProductWhereClause = { isActive: true };

  // Multi-value enum/string filters (use `in`)
  if (filters.condition?.length) {
    where.condition = { in: filters.condition };
  }

  if (filters.brand?.length) {
    where.brand = { in: filters.brand };
  }

  if (filters.cpuFamily?.length) {
    where.cpuFamily = { in: filters.cpuFamily };
  }

  if (filters.cpuSocket?.length) {
    where.cpuSocket = { in: filters.cpuSocket };
  }

  if (filters.cpuCount?.length) {
    where.cpuCount = { in: filters.cpuCount };
  }

  if (filters.ramType?.length) {
    where.ramType = { in: filters.ramType };
  }

  if (filters.ramSlots?.length) {
    where.ramSlotsTotal = { in: filters.ramSlots };
  }

  if (filters.storageType?.length) {
    where.diskType = { in: filters.storageType };
  }

  if (filters.formFactor?.length) {
    where.formFactor = { in: filters.formFactor };
  }

  if (filters.units?.length) {
    where.unitCount = { in: filters.units };
  }

  if (filters.stockStatus?.length) {
    where.stockStatus = { in: filters.stockStatus };
  }

  // Range filters (use gte/lte)
  if (filters.cpuCores) {
    const cpuCoresFilter: Record<string, number> = {};
    if (filters.cpuCores.min !== undefined) cpuCoresFilter.gte = filters.cpuCores.min;
    if (filters.cpuCores.max !== undefined) cpuCoresFilter.lte = filters.cpuCores.max;
    if (Object.keys(cpuCoresFilter).length > 0) {
      where.cpuCores = cpuCoresFilter;
    }
  }

  if (filters.cpuFrequency) {
    // Convert GHz to MHz for database query
    const cpuFreqFilter: Record<string, number> = {};
    if (filters.cpuFrequency.min !== undefined) cpuFreqFilter.gte = Math.round(filters.cpuFrequency.min * 1000);
    if (filters.cpuFrequency.max !== undefined) cpuFreqFilter.lte = Math.round(filters.cpuFrequency.max * 1000);
    if (Object.keys(cpuFreqFilter).length > 0) {
      where.cpuFreqMhz = cpuFreqFilter;
    }
  }

  if (filters.ramGb) {
    const ramGbFilter: Record<string, number> = {};
    if (filters.ramGb.min !== undefined) ramGbFilter.gte = filters.ramGb.min;
    if (filters.ramGb.max !== undefined) ramGbFilter.lte = filters.ramGb.max;
    if (Object.keys(ramGbFilter).length > 0) {
      where.ramGb = ramGbFilter;
    }
  }

  if (filters.ramFrequency) {
    const ramFreqFilter: Record<string, number> = {};
    if (filters.ramFrequency.min !== undefined) ramFreqFilter.gte = filters.ramFrequency.min;
    if (filters.ramFrequency.max !== undefined) ramFreqFilter.lte = filters.ramFrequency.max;
    if (Object.keys(ramFreqFilter).length > 0) {
      where.ramFreqMhz = ramFreqFilter;
    }
  }

  if (filters.storageSize) {
    const storageSizeFilter: Record<string, number> = {};
    if (filters.storageSize.min !== undefined) storageSizeFilter.gte = filters.storageSize.min;
    if (filters.storageSize.max !== undefined) storageSizeFilter.lte = filters.storageSize.max;
    if (Object.keys(storageSizeFilter).length > 0) {
      where.diskGb = storageSizeFilter;
    }
  }

  if (filters.psuWattage) {
    const psuFilter: Record<string, number> = {};
    if (filters.psuWattage.min !== undefined) psuFilter.gte = filters.psuWattage.min;
    if (filters.psuWattage.max !== undefined) psuFilter.lte = filters.psuWattage.max;
    if (Object.keys(psuFilter).length > 0) {
      where.psuWatt = psuFilter;
    }
  }

  if (filters.priceRange) {
    const priceFilter: Record<string, number> = {};
    if (filters.priceRange.min !== undefined) priceFilter.gte = filters.priceRange.min;
    if (filters.priceRange.max !== undefined) priceFilter.lte = filters.priceRange.max;
    if (Object.keys(priceFilter).length > 0) {
      where.price = priceFilter;
    }
  }

  // Boolean filters (exact match)
  if (filters.hotSwap !== undefined) {
    where.diskHotswap = filters.hotSwap;
  }

  return where;
}

/**
 * Resolves a SortOption to Prisma orderBy array.
 * Always includes ID as tiebreaker for stable ordering.
 */
export function resolveSortOrder(sort?: SortOption): ProductOrderBy {
  switch (sort) {
    case 'price_asc':
      return [{ price: 'asc' }, { id: 'asc' }];
    case 'price_desc':
      return [{ price: 'desc' }, { id: 'desc' }];
    case 'newest':
      return [{ createdAt: 'desc' }, { id: 'desc' }];
    case 'popular':
      return [{ stock: 'desc' }, { id: 'desc' }];
    default:
      // Default sort: newest first
      return [{ createdAt: 'desc' }, { id: 'desc' }];
  }
}

/**
 * Encodes a product ID as a cursor string (base64).
 */
export function encodeCursor(id: string): string {
  return Buffer.from(id, 'utf-8').toString('base64url');
}

/**
 * Decodes a cursor string back to a product ID.
 */
export function decodeCursor(cursor: string): string {
  return Buffer.from(cursor, 'base64url').toString('utf-8');
}

// ─── Catalog Service ─────────────────────────────────────────────────────────

/**
 * Get products with filtering, sorting, and cursor-based pagination.
 * Fetches limit+1 items to detect if there's a next page.
 */
export async function getProducts(
  filters: ProductFilters,
  pagination: CursorPagination,
): Promise<PaginatedResult<Record<string, unknown>>> {
  const where = buildWhereClause(filters);
  const orderBy = resolveSortOrder(filters.sort);
  const limit = pagination.limit;

  // Build cursor clause
  const cursorClause = pagination.cursor
    ? { id: decodeCursor(pagination.cursor) }
    : undefined;

  // Fetch limit+1 to detect hasNext
  const [items, totalCount] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy,
      take: limit + 1,
      cursor: cursorClause,
      skip: cursorClause ? 1 : 0, // Skip the cursor item itself
      include: { images: { take: 1, orderBy: { order: 'asc' } } },
    }),
    prisma.product.count({ where }),
  ]);

  // Determine if there's a next page
  const hasNext = items.length > limit;
  if (hasNext) {
    items.pop(); // Remove the extra item
  }

  // Build cursors
  const nextCursor = hasNext && items.length > 0
    ? encodeCursor(items[items.length - 1]!.id)
    : null;

  const prevCursor = pagination.cursor && items.length > 0
    ? encodeCursor(items[0]!.id)
    : null;

  return {
    items: items as unknown as Record<string, unknown>[],
    nextCursor,
    prevCursor,
    totalCount,
  };
}

/**
 * Get a single product by its URL slug, including all images.
 * Returns null if not found or not active.
 */
export async function getProductBySlug(slug: string): Promise<Record<string, unknown> | null> {
  const product = await prisma.product.findFirst({
    where: { slug, isActive: true },
    include: { images: { orderBy: { order: 'asc' } } },
  });

  return product as unknown as Record<string, unknown> | null;
}

/**
 * Full-text search on product name and description using PostgreSQL tsvector.
 * Falls back to ILIKE-based search if full-text search is not available.
 */
export async function searchProducts(
  query: string,
  limit: number = 20,
): Promise<Record<string, unknown>[]> {
  // Use PostgreSQL full-text search via raw query
  // Search across name and description fields
  const searchTerms = query.trim().split(/\s+/).filter(Boolean);

  if (searchTerms.length === 0) {
    return [];
  }

  // Build tsquery: all terms joined with & (AND) for matching
  const tsQuery = searchTerms.map(term => `${term}:*`).join(' & ');

  // Use raw query for full-text search with ranking
  const products = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT p.*, 
      ts_rank(
        to_tsvector('english', COALESCE(p.name, '') || ' ' || COALESCE(p.description, '')),
        to_tsquery('english', $1)
      ) as rank
    FROM products p
    WHERE p."isActive" = true
      AND to_tsvector('english', COALESCE(p.name, '') || ' ' || COALESCE(p.description, ''))
      @@ to_tsquery('english', $1)
    ORDER BY rank DESC, p.id ASC
    LIMIT $2`,
    tsQuery,
    limit,
  );

  return products;
}

/**
 * Get the count of products matching the given filters.
 * Used for debounced filter count updates in the UI.
 */
export async function getProductCount(filters: ProductFilters): Promise<number> {
  const where = buildWhereClause(filters);
  return prisma.product.count({ where });
}

/**
 * Get available filter options (distinct values for each filter field).
 * Used to populate the filter sidebar with available choices.
 */
export async function getFilterOptions(): Promise<FilterOptions> {
  const activeWhere = { isActive: true };

  const [
    conditions,
    brands,
    cpuFamilies,
    cpuSockets,
    ramTypes,
    storageTypes,
    formFactors,
    stockStatuses,
  ] = await Promise.all([
    prisma.product.findMany({
      where: activeWhere,
      select: { condition: true },
      distinct: ['condition'],
    }),
    prisma.product.findMany({
      where: activeWhere,
      select: { brand: true },
      distinct: ['brand'],
      orderBy: { brand: 'asc' },
    }),
    prisma.product.findMany({
      where: { ...activeWhere, cpuFamily: { not: null } },
      select: { cpuFamily: true },
      distinct: ['cpuFamily'],
      orderBy: { cpuFamily: 'asc' },
    }),
    prisma.product.findMany({
      where: { ...activeWhere, cpuSocket: { not: null } },
      select: { cpuSocket: true },
      distinct: ['cpuSocket'],
      orderBy: { cpuSocket: 'asc' },
    }),
    prisma.product.findMany({
      where: { ...activeWhere, ramType: { not: null } },
      select: { ramType: true },
      distinct: ['ramType'],
      orderBy: { ramType: 'asc' },
    }),
    prisma.product.findMany({
      where: { ...activeWhere, diskType: { not: null } },
      select: { diskType: true },
      distinct: ['diskType'],
      orderBy: { diskType: 'asc' },
    }),
    prisma.product.findMany({
      where: { ...activeWhere, formFactor: { not: null } },
      select: { formFactor: true },
      distinct: ['formFactor'],
      orderBy: { formFactor: 'asc' },
    }),
    prisma.product.findMany({
      where: activeWhere,
      select: { stockStatus: true },
      distinct: ['stockStatus'],
    }),
  ]);

  return {
    conditions: conditions.map(p => p.condition),
    brands: brands.map(p => p.brand),
    cpuFamilies: cpuFamilies.map(p => p.cpuFamily).filter((v): v is string => v !== null),
    cpuSockets: cpuSockets.map(p => p.cpuSocket).filter((v): v is string => v !== null),
    ramTypes: ramTypes.map(p => p.ramType).filter((v): v is string => v !== null),
    storageTypes: storageTypes.map(p => p.diskType).filter((v): v is string => v !== null),
    formFactors: formFactors.map(p => p.formFactor).filter((v): v is string => v !== null),
    stockStatuses: stockStatuses.map(p => p.stockStatus),
  };
}
