import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ProductFilters, CursorPagination } from '@kiroportal/types';

// Mock prisma
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    product: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(0),
    },
    $queryRawUnsafe: vi.fn().mockResolvedValue([]),
  },
}));

import { prisma } from '../lib/prisma.js';
import {
  buildWhereClause,
  resolveSortOrder,
  encodeCursor,
  decodeCursor,
  getProducts,
  getProductBySlug,
  searchProducts,
  getProductCount,
  getFilterOptions,
} from './catalog.service.js';

const mockPrisma = prisma as unknown as {
  product: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  $queryRawUnsafe: ReturnType<typeof vi.fn>;
};

// ─── buildWhereClause Tests ──────────────────────────────────────────────────

describe('buildWhereClause', () => {
  it('returns base clause with isActive:true when no filters provided', () => {
    const result = buildWhereClause({});
    expect(result).toEqual({ isActive: true });
  });

  it('builds condition filter using `in` operator', () => {
    const filters: ProductFilters = { condition: ['NEW', 'USED'] };
    const result = buildWhereClause(filters);
    expect(result.condition).toEqual({ in: ['NEW', 'USED'] });
  });

  it('builds brand filter using `in` operator', () => {
    const filters: ProductFilters = { brand: ['Dell', 'HP'] };
    const result = buildWhereClause(filters);
    expect(result.brand).toEqual({ in: ['Dell', 'HP'] });
  });

  it('builds cpuFamily filter using `in` operator', () => {
    const filters: ProductFilters = { cpuFamily: ['Xeon', 'EPYC'] };
    const result = buildWhereClause(filters);
    expect(result.cpuFamily).toEqual({ in: ['Xeon', 'EPYC'] });
  });

  it('builds cpuSocket filter using `in` operator', () => {
    const filters: ProductFilters = { cpuSocket: ['LGA 2066', 'SP3'] };
    const result = buildWhereClause(filters);
    expect(result.cpuSocket).toEqual({ in: ['LGA 2066', 'SP3'] });
  });

  it('builds cpuCount filter using `in` operator', () => {
    const filters: ProductFilters = { cpuCount: [1, 2] };
    const result = buildWhereClause(filters);
    expect(result.cpuCount).toEqual({ in: [1, 2] });
  });

  it('builds ramType filter using `in` operator', () => {
    const filters: ProductFilters = { ramType: ['DDR4', 'DDR5'] };
    const result = buildWhereClause(filters);
    expect(result.ramType).toEqual({ in: ['DDR4', 'DDR5'] });
  });

  it('builds ramSlots filter mapped to ramSlotsTotal', () => {
    const filters: ProductFilters = { ramSlots: [8, 16] };
    const result = buildWhereClause(filters);
    expect(result.ramSlotsTotal).toEqual({ in: [8, 16] });
  });

  it('builds storageType filter mapped to diskType', () => {
    const filters: ProductFilters = { storageType: ['SSD', 'NVMe'] };
    const result = buildWhereClause(filters);
    expect(result.diskType).toEqual({ in: ['SSD', 'NVMe'] });
  });

  it('builds formFactor filter using `in` operator', () => {
    const filters: ProductFilters = { formFactor: ['1U', '2U'] };
    const result = buildWhereClause(filters);
    expect(result.formFactor).toEqual({ in: ['1U', '2U'] });
  });

  it('builds units filter mapped to unitCount', () => {
    const filters: ProductFilters = { units: [1, 2, 4] };
    const result = buildWhereClause(filters);
    expect(result.unitCount).toEqual({ in: [1, 2, 4] });
  });

  it('builds stockStatus filter using `in` operator', () => {
    const filters: ProductFilters = { stockStatus: ['IN_STOCK', 'LOW_STOCK'] };
    const result = buildWhereClause(filters);
    expect(result.stockStatus).toEqual({ in: ['IN_STOCK', 'LOW_STOCK'] });
  });

  // Range filters
  it('builds cpuCores range filter with gte/lte', () => {
    const filters: ProductFilters = { cpuCores: { min: 8, max: 64 } };
    const result = buildWhereClause(filters);
    expect(result.cpuCores).toEqual({ gte: 8, lte: 64 });
  });

  it('builds cpuCores range filter with only min', () => {
    const filters: ProductFilters = { cpuCores: { min: 16 } };
    const result = buildWhereClause(filters);
    expect(result.cpuCores).toEqual({ gte: 16 });
  });

  it('builds cpuCores range filter with only max', () => {
    const filters: ProductFilters = { cpuCores: { max: 32 } };
    const result = buildWhereClause(filters);
    expect(result.cpuCores).toEqual({ lte: 32 });
  });

  it('builds cpuFrequency range filter converting GHz to MHz', () => {
    const filters: ProductFilters = { cpuFrequency: { min: 2.4, max: 3.8 } };
    const result = buildWhereClause(filters);
    expect(result.cpuFreqMhz).toEqual({ gte: 2400, lte: 3800 });
  });

  it('builds ramGb range filter with gte/lte', () => {
    const filters: ProductFilters = { ramGb: { min: 32, max: 256 } };
    const result = buildWhereClause(filters);
    expect(result.ramGb).toEqual({ gte: 32, lte: 256 });
  });

  it('builds ramFrequency range filter', () => {
    const filters: ProductFilters = { ramFrequency: { min: 2400, max: 3200 } };
    const result = buildWhereClause(filters);
    expect(result.ramFreqMhz).toEqual({ gte: 2400, lte: 3200 });
  });

  it('builds storageSize range filter mapped to diskGb', () => {
    const filters: ProductFilters = { storageSize: { min: 500, max: 4000 } };
    const result = buildWhereClause(filters);
    expect(result.diskGb).toEqual({ gte: 500, lte: 4000 });
  });

  it('builds psuWattage range filter mapped to psuWatt', () => {
    const filters: ProductFilters = { psuWattage: { min: 500, max: 1200 } };
    const result = buildWhereClause(filters);
    expect(result.psuWatt).toEqual({ gte: 500, lte: 1200 });
  });

  it('builds priceRange filter', () => {
    const filters: ProductFilters = { priceRange: { min: 1000, max: 5000 } };
    const result = buildWhereClause(filters);
    expect(result.price).toEqual({ gte: 1000, lte: 5000 });
  });

  // Boolean filters
  it('builds hotSwap boolean filter mapped to diskHotswap (true)', () => {
    const filters: ProductFilters = { hotSwap: true };
    const result = buildWhereClause(filters);
    expect(result.diskHotswap).toBe(true);
  });

  it('builds hotSwap boolean filter mapped to diskHotswap (false)', () => {
    const filters: ProductFilters = { hotSwap: false };
    const result = buildWhereClause(filters);
    expect(result.diskHotswap).toBe(false);
  });

  // Combined filters
  it('combines multiple filters with AND logic', () => {
    const filters: ProductFilters = {
      condition: ['NEW'],
      brand: ['Dell'],
      cpuCores: { min: 16 },
      ramGb: { min: 64, max: 256 },
      priceRange: { min: 2000, max: 10000 },
      hotSwap: true,
      stockStatus: ['IN_STOCK'],
    };
    const result = buildWhereClause(filters);

    expect(result.isActive).toBe(true);
    expect(result.condition).toEqual({ in: ['NEW'] });
    expect(result.brand).toEqual({ in: ['Dell'] });
    expect(result.cpuCores).toEqual({ gte: 16 });
    expect(result.ramGb).toEqual({ gte: 64, lte: 256 });
    expect(result.price).toEqual({ gte: 2000, lte: 10000 });
    expect(result.diskHotswap).toBe(true);
    expect(result.stockStatus).toEqual({ in: ['IN_STOCK'] });
  });

  // Empty arrays should not add filter
  it('ignores empty arrays for multi-value filters', () => {
    const filters: ProductFilters = {
      condition: [],
      brand: [],
      cpuFamily: [],
    };
    const result = buildWhereClause(filters);
    expect(result).toEqual({ isActive: true });
  });

  // Empty range (no min/max) should not add filter
  it('ignores range filters with no min or max', () => {
    const filters: ProductFilters = {
      cpuCores: {},
      ramGb: {},
    };
    const result = buildWhereClause(filters);
    expect(result).toEqual({ isActive: true });
  });
});

// ─── resolveSortOrder Tests ──────────────────────────────────────────────────

describe('resolveSortOrder', () => {
  it('returns price ascending with ID tiebreaker for price_asc', () => {
    const result = resolveSortOrder('price_asc');
    expect(result).toEqual([{ price: 'asc' }, { id: 'asc' }]);
  });

  it('returns price descending with ID tiebreaker for price_desc', () => {
    const result = resolveSortOrder('price_desc');
    expect(result).toEqual([{ price: 'desc' }, { id: 'desc' }]);
  });

  it('returns createdAt descending with ID tiebreaker for newest', () => {
    const result = resolveSortOrder('newest');
    expect(result).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });

  it('returns stock descending with ID tiebreaker for popular', () => {
    const result = resolveSortOrder('popular');
    expect(result).toEqual([{ stock: 'desc' }, { id: 'desc' }]);
  });

  it('returns default sort (newest) when no sort option provided', () => {
    const result = resolveSortOrder(undefined);
    expect(result).toEqual([{ createdAt: 'desc' }, { id: 'desc' }]);
  });
});

// ─── Cursor Encoding/Decoding Tests ─────────────────────────────────────────

describe('encodeCursor / decodeCursor', () => {
  it('encodes and decodes a cursor round-trip', () => {
    const id = 'clxyz123abc';
    const cursor = encodeCursor(id);
    expect(decodeCursor(cursor)).toBe(id);
  });

  it('produces a base64url-safe string', () => {
    const id = 'some-product-id-with-special+chars/=';
    const cursor = encodeCursor(id);
    // base64url should not contain +, /, or =
    expect(cursor).not.toMatch(/[+/=]/);
  });

  it('handles empty string', () => {
    const cursor = encodeCursor('');
    expect(decodeCursor(cursor)).toBe('');
  });
});

// ─── getProducts Tests ───────────────────────────────────────────────────────

describe('getProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches limit+1 items to detect hasNext', async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.product.count.mockResolvedValue(0);

    const pagination: CursorPagination = { limit: 20, direction: 'forward' };
    await getProducts({}, pagination);

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 21 }),
    );
  });

  it('returns hasNext=true when more items exist', async () => {
    // Return 21 items (limit+1) to indicate there's a next page
    const items = Array.from({ length: 21 }, (_, i) => ({
      id: `product-${i}`,
      name: `Product ${i}`,
    }));
    mockPrisma.product.findMany.mockResolvedValue(items);
    mockPrisma.product.count.mockResolvedValue(50);

    const pagination: CursorPagination = { limit: 20, direction: 'forward' };
    const result = await getProducts({}, pagination);

    expect(result.items).toHaveLength(20);
    expect(result.nextCursor).not.toBeNull();
    expect(result.totalCount).toBe(50);
  });

  it('returns hasNext=false when no more items', async () => {
    const items = Array.from({ length: 5 }, (_, i) => ({
      id: `product-${i}`,
      name: `Product ${i}`,
    }));
    mockPrisma.product.findMany.mockResolvedValue(items);
    mockPrisma.product.count.mockResolvedValue(5);

    const pagination: CursorPagination = { limit: 20, direction: 'forward' };
    const result = await getProducts({}, pagination);

    expect(result.items).toHaveLength(5);
    expect(result.nextCursor).toBeNull();
    expect(result.totalCount).toBe(5);
  });

  it('applies cursor with skip:1 when cursor is provided', async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.product.count.mockResolvedValue(0);

    const cursorId = 'product-10';
    const cursor = encodeCursor(cursorId);
    const pagination: CursorPagination = { cursor, limit: 20, direction: 'forward' };
    await getProducts({}, pagination);

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: { id: cursorId },
        skip: 1,
      }),
    );
  });

  it('does not skip when no cursor is provided', async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.product.count.mockResolvedValue(0);

    const pagination: CursorPagination = { limit: 20, direction: 'forward' };
    await getProducts({}, pagination);

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        cursor: undefined,
        skip: 0,
      }),
    );
  });

  it('returns prevCursor when cursor is provided and items exist', async () => {
    const items = [{ id: 'product-11', name: 'Product 11' }];
    mockPrisma.product.findMany.mockResolvedValue(items);
    mockPrisma.product.count.mockResolvedValue(20);

    const cursor = encodeCursor('product-10');
    const pagination: CursorPagination = { cursor, limit: 20, direction: 'forward' };
    const result = await getProducts({}, pagination);

    expect(result.prevCursor).not.toBeNull();
  });

  it('returns null prevCursor when no cursor is provided', async () => {
    const items = [{ id: 'product-1', name: 'Product 1' }];
    mockPrisma.product.findMany.mockResolvedValue(items);
    mockPrisma.product.count.mockResolvedValue(1);

    const pagination: CursorPagination = { limit: 20, direction: 'forward' };
    const result = await getProducts({}, pagination);

    expect(result.prevCursor).toBeNull();
  });

  it('passes filters to the where clause', async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.product.count.mockResolvedValue(0);

    const filters: ProductFilters = { brand: ['Dell'], condition: ['NEW'] };
    const pagination: CursorPagination = { limit: 20, direction: 'forward' };
    await getProducts(filters, pagination);

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          brand: { in: ['Dell'] },
          condition: { in: ['NEW'] },
          isActive: true,
        }),
      }),
    );
  });

  it('applies sort order from filters', async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.product.count.mockResolvedValue(0);

    const filters: ProductFilters = { sort: 'price_asc' };
    const pagination: CursorPagination = { limit: 20, direction: 'forward' };
    await getProducts(filters, pagination);

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ price: 'asc' }, { id: 'asc' }],
      }),
    );
  });

  it('includes first image in results', async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);
    mockPrisma.product.count.mockResolvedValue(0);

    const pagination: CursorPagination = { limit: 20, direction: 'forward' };
    await getProducts({}, pagination);

    expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: { images: { take: 1, orderBy: { order: 'asc' } } },
      }),
    );
  });
});

// ─── getProductBySlug Tests ──────────────────────────────────────────────────

describe('getProductBySlug', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries by slug with isActive:true', async () => {
    mockPrisma.product.findFirst.mockResolvedValue(null);

    await getProductBySlug('dell-poweredge-r740');

    expect(mockPrisma.product.findFirst).toHaveBeenCalledWith({
      where: { slug: 'dell-poweredge-r740', isActive: true },
      include: { images: { orderBy: { order: 'asc' } } },
    });
  });

  it('returns null when product not found', async () => {
    mockPrisma.product.findFirst.mockResolvedValue(null);

    const result = await getProductBySlug('non-existent');
    expect(result).toBeNull();
  });

  it('returns product with all images when found', async () => {
    const mockProduct = {
      id: 'prod-1',
      slug: 'dell-r740',
      name: 'Dell R740',
      images: [{ id: 'img-1', url: '/img.jpg', order: 0 }],
    };
    mockPrisma.product.findFirst.mockResolvedValue(mockProduct);

    const result = await getProductBySlug('dell-r740');
    expect(result).toEqual(mockProduct);
  });
});

// ─── searchProducts Tests ────────────────────────────────────────────────────

describe('searchProducts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds tsquery from search terms', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

    await searchProducts('dell poweredge');

    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('to_tsquery'),
      'dell:* & poweredge:*',
      20,
    );
  });

  it('returns empty array for empty/whitespace query', async () => {
    const result = await searchProducts('   ');
    expect(result).toEqual([]);
    expect(mockPrisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('respects the limit parameter', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

    await searchProducts('server', 10);

    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.any(String),
      'server:*',
      10,
    );
  });

  it('handles single search term', async () => {
    mockPrisma.$queryRawUnsafe.mockResolvedValue([]);

    await searchProducts('xeon');

    expect(mockPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.any(String),
      'xeon:*',
      20,
    );
  });
});

// ─── getProductCount Tests ───────────────────────────────────────────────────

describe('getProductCount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('counts products with the same where clause as getProducts', async () => {
    mockPrisma.product.count.mockResolvedValue(42);

    const filters: ProductFilters = { brand: ['HP'], condition: ['REFURBISHED'] };
    const count = await getProductCount(filters);

    expect(count).toBe(42);
    expect(mockPrisma.product.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        brand: { in: ['HP'] },
        condition: { in: ['REFURBISHED'] },
        isActive: true,
      }),
    });
  });

  it('returns 0 when no products match', async () => {
    mockPrisma.product.count.mockResolvedValue(0);

    const count = await getProductCount({ brand: ['NonExistent'] });
    expect(count).toBe(0);
  });
});

// ─── getFilterOptions Tests ──────────────────────────────────────────────────

describe('getFilterOptions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries distinct values for all filter fields', async () => {
    mockPrisma.product.findMany.mockResolvedValue([]);

    await getFilterOptions();

    // Should make 8 distinct queries
    expect(mockPrisma.product.findMany).toHaveBeenCalledTimes(8);
  });

  it('maps results to FilterOptions structure', async () => {
    // Mock each findMany call in order
    mockPrisma.product.findMany
      .mockResolvedValueOnce([{ condition: 'NEW' }, { condition: 'USED' }])
      .mockResolvedValueOnce([{ brand: 'Dell' }, { brand: 'HP' }])
      .mockResolvedValueOnce([{ cpuFamily: 'Xeon' }])
      .mockResolvedValueOnce([{ cpuSocket: 'LGA 2066' }])
      .mockResolvedValueOnce([{ ramType: 'DDR4' }])
      .mockResolvedValueOnce([{ diskType: 'SSD' }, { diskType: 'NVMe' }])
      .mockResolvedValueOnce([{ formFactor: '1U' }, { formFactor: '2U' }])
      .mockResolvedValueOnce([{ stockStatus: 'IN_STOCK' }]);

    const result = await getFilterOptions();

    expect(result.conditions).toEqual(['NEW', 'USED']);
    expect(result.brands).toEqual(['Dell', 'HP']);
    expect(result.cpuFamilies).toEqual(['Xeon']);
    expect(result.cpuSockets).toEqual(['LGA 2066']);
    expect(result.ramTypes).toEqual(['DDR4']);
    expect(result.storageTypes).toEqual(['SSD', 'NVMe']);
    expect(result.formFactors).toEqual(['1U', '2U']);
    expect(result.stockStatuses).toEqual(['IN_STOCK']);
  });

  it('filters out null values from optional fields', async () => {
    mockPrisma.product.findMany
      .mockResolvedValueOnce([{ condition: 'NEW' }])
      .mockResolvedValueOnce([{ brand: 'Dell' }])
      .mockResolvedValueOnce([{ cpuFamily: null }, { cpuFamily: 'Xeon' }])
      .mockResolvedValueOnce([{ cpuSocket: null }])
      .mockResolvedValueOnce([{ ramType: null }])
      .mockResolvedValueOnce([{ diskType: null }])
      .mockResolvedValueOnce([{ formFactor: null }])
      .mockResolvedValueOnce([{ stockStatus: 'IN_STOCK' }]);

    const result = await getFilterOptions();

    expect(result.cpuFamilies).toEqual(['Xeon']);
    expect(result.cpuSockets).toEqual([]);
    expect(result.ramTypes).toEqual([]);
    expect(result.storageTypes).toEqual([]);
    expect(result.formFactors).toEqual([]);
  });
});
