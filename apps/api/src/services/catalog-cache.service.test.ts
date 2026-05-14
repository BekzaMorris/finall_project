import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the cache module
vi.mock('../lib/cache.js', () => ({
  generateCacheKey: vi.fn((prefix: string, params: Record<string, unknown>) => {
    return `${prefix}:mock-hash`;
  }),
  getFromCache: vi.fn(),
  setInCache: vi.fn(),
  invalidateByPattern: vi.fn(),
}));

// Mock the catalog service
vi.mock('./catalog.service.js', () => ({
  getProducts: vi.fn(),
  getFilterOptions: vi.fn(),
  getProductCount: vi.fn(),
}));

import {
  getCachedProducts,
  getCachedFilterOptions,
  getCachedProductCount,
  invalidateProductCaches,
} from './catalog-cache.service.js';
import { getFromCache, setInCache, invalidateByPattern, generateCacheKey } from '../lib/cache.js';
import { getProducts, getFilterOptions, getProductCount } from './catalog.service.js';

describe('catalog-cache.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCachedProducts', () => {
    const filters = { brand: ['Dell'] } as any;
    const pagination = { limit: 20 } as any;
    const mockResult = {
      items: [{ id: '1', name: 'Server 1' }],
      nextCursor: null,
      prevCursor: null,
      totalCount: 1,
    };

    it('returns cached data on cache hit without querying DB', async () => {
      vi.mocked(getFromCache).mockResolvedValue(mockResult);

      const result = await getCachedProducts(filters, pagination);

      expect(result).toEqual(mockResult);
      expect(getFromCache).toHaveBeenCalledOnce();
      expect(getProducts).not.toHaveBeenCalled();
      expect(setInCache).not.toHaveBeenCalled();
    });

    it('queries DB and caches result on cache miss', async () => {
      vi.mocked(getFromCache).mockResolvedValue(null);
      vi.mocked(getProducts).mockResolvedValue(mockResult);
      vi.mocked(setInCache).mockResolvedValue(undefined);

      const result = await getCachedProducts(filters, pagination);

      expect(result).toEqual(mockResult);
      expect(getFromCache).toHaveBeenCalledOnce();
      expect(getProducts).toHaveBeenCalledWith(filters, pagination);
      expect(setInCache).toHaveBeenCalledWith(
        expect.any(String),
        mockResult,
        600, // 10 minutes
      );
    });

    it('generates cache key with products:list prefix', async () => {
      vi.mocked(getFromCache).mockResolvedValue(mockResult);

      await getCachedProducts(filters, pagination);

      expect(generateCacheKey).toHaveBeenCalledWith('products:list', {
        filters,
        pagination,
      });
    });
  });

  describe('getCachedFilterOptions', () => {
    const mockFilterOptions = {
      conditions: ['NEW', 'USED'],
      brands: ['Dell', 'HP'],
      cpuFamilies: ['Xeon'],
      cpuSockets: ['LGA2066'],
      ramTypes: ['DDR4'],
      storageTypes: ['SSD'],
      formFactors: ['1U'],
      stockStatuses: ['IN_STOCK'],
    };

    it('returns cached data on cache hit without querying DB', async () => {
      vi.mocked(getFromCache).mockResolvedValue(mockFilterOptions);

      const result = await getCachedFilterOptions();

      expect(result).toEqual(mockFilterOptions);
      expect(getFromCache).toHaveBeenCalledOnce();
      expect(getFilterOptions).not.toHaveBeenCalled();
    });

    it('queries DB and caches result with 1hr TTL on cache miss', async () => {
      vi.mocked(getFromCache).mockResolvedValue(null);
      vi.mocked(getFilterOptions).mockResolvedValue(mockFilterOptions);
      vi.mocked(setInCache).mockResolvedValue(undefined);

      const result = await getCachedFilterOptions();

      expect(result).toEqual(mockFilterOptions);
      expect(getFilterOptions).toHaveBeenCalledOnce();
      expect(setInCache).toHaveBeenCalledWith(
        'products:filters',
        mockFilterOptions,
        3600, // 1 hour
      );
    });
  });

  describe('getCachedProductCount', () => {
    const filters = { condition: ['NEW'] } as any;

    it('returns cached count on cache hit', async () => {
      vi.mocked(getFromCache).mockResolvedValue(42);

      const result = await getCachedProductCount(filters);

      expect(result).toBe(42);
      expect(getProductCount).not.toHaveBeenCalled();
    });

    it('queries DB and caches count with 10min TTL on cache miss', async () => {
      vi.mocked(getFromCache).mockResolvedValue(null);
      vi.mocked(getProductCount).mockResolvedValue(15);
      vi.mocked(setInCache).mockResolvedValue(undefined);

      const result = await getCachedProductCount(filters);

      expect(result).toBe(15);
      expect(getProductCount).toHaveBeenCalledWith(filters);
      expect(setInCache).toHaveBeenCalledWith(
        expect.any(String),
        15,
        600, // 10 minutes
      );
    });

    it('generates cache key with products:count prefix', async () => {
      vi.mocked(getFromCache).mockResolvedValue(null);
      vi.mocked(getProductCount).mockResolvedValue(10);
      vi.mocked(setInCache).mockResolvedValue(undefined);

      await getCachedProductCount(filters);

      expect(generateCacheKey).toHaveBeenCalledWith('products:count', { filters });
    });
  });

  describe('invalidateProductCaches', () => {
    it('invalidates all product-related cache patterns', async () => {
      vi.mocked(invalidateByPattern).mockResolvedValue(undefined);

      await invalidateProductCaches();

      expect(invalidateByPattern).toHaveBeenCalledWith('products:list:*');
      expect(invalidateByPattern).toHaveBeenCalledWith('products:count:*');
      expect(invalidateByPattern).toHaveBeenCalledWith('products:filters');
    });

    it('invalidates all caches even when productId is provided', async () => {
      vi.mocked(invalidateByPattern).mockResolvedValue(undefined);

      await invalidateProductCaches('product-123');

      expect(invalidateByPattern).toHaveBeenCalledWith('products:list:*');
      expect(invalidateByPattern).toHaveBeenCalledWith('products:count:*');
      expect(invalidateByPattern).toHaveBeenCalledWith('products:filters');
    });

    it('runs invalidation in parallel for speed', async () => {
      const callOrder: string[] = [];
      vi.mocked(invalidateByPattern).mockImplementation(async (pattern) => {
        callOrder.push(pattern);
        // Simulate async work
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      const start = Date.now();
      await invalidateProductCaches();
      const elapsed = Date.now() - start;

      // All three patterns should be invalidated
      expect(callOrder).toHaveLength(3);
      // Parallel execution should complete in roughly the time of one call, not three
      expect(elapsed).toBeLessThan(50);
    });
  });
});
