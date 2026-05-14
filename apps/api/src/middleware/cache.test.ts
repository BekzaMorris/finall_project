import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { cacheMiddleware } from './cache.js';

// Mock the cache and redis modules
vi.mock('../lib/cache.js', () => ({
  generateCacheKey: vi.fn(
    (prefix: string, params: Record<string, unknown>) => `${prefix}:mock-hash`,
  ),
  getFromCache: vi.fn(),
  setInCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../lib/redis.js', () => ({
  isRedisAvailable: vi.fn(),
}));

import { generateCacheKey, getFromCache, setInCache } from '../lib/cache.js';
import { isRedisAvailable } from '../lib/redis.js';

const mockGenerateCacheKey = vi.mocked(generateCacheKey);
const mockGetFromCache = vi.mocked(getFromCache);
const mockSetInCache = vi.mocked(setInCache);
const mockIsRedisAvailable = vi.mocked(isRedisAvailable);

function createMockReq(
  overrides: Partial<Request> = {},
): Request {
  return {
    method: 'GET',
    path: '/api/products',
    query: {},
    ...overrides,
  } as unknown as Request;
}

function createMockRes(): Response & { _jsonData?: unknown } {
  const res = {
    statusCode: 200,
    _jsonData: undefined as unknown,
    json: vi.fn(function (this: Response & { _jsonData?: unknown }, data: unknown) {
      this._jsonData = data;
      return this;
    }),
  } as unknown as Response & { _jsonData?: unknown };
  return res;
}

describe('cacheMiddleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn();
    mockIsRedisAvailable.mockResolvedValue(true);
  });

  it('returns cached response on cache hit', async () => {
    const cachedData = { items: [{ id: '1', name: 'Server' }], totalCount: 1 };
    mockGetFromCache.mockResolvedValue(cachedData);

    const middleware = cacheMiddleware({ prefix: 'products', ttl: 600 });
    const req = createMockReq({ query: { brand: 'Dell' } });
    const res = createMockRes();

    await middleware(req, res, next);

    expect(res.json).toHaveBeenCalledWith(cachedData);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next and wraps res.json on cache miss', async () => {
    mockGetFromCache.mockResolvedValue(null);

    const middleware = cacheMiddleware({ prefix: 'products', ttl: 600 });
    const req = createMockReq();
    const res = createMockRes();
    const originalJson = res.json;

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    // res.json has been wrapped (replaced), so it's no longer the original spy
    expect(originalJson).not.toHaveBeenCalled();

    // Simulate the route handler calling res.json
    const responseData = { items: [], totalCount: 0 };
    res.json(responseData);

    // Wait for async cache write
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockSetInCache).toHaveBeenCalledWith(
      'products:mock-hash',
      responseData,
      600,
    );
  });

  it('falls back to normal processing when Redis is unavailable', async () => {
    mockIsRedisAvailable.mockResolvedValue(false);

    const middleware = cacheMiddleware({ prefix: 'products', ttl: 600 });
    const req = createMockReq();
    const res = createMockRes();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(mockGetFromCache).not.toHaveBeenCalled();
  });

  it('skips caching for non-GET requests', async () => {
    const middleware = cacheMiddleware({ prefix: 'products', ttl: 600 });
    const req = createMockReq({ method: 'POST' });
    const res = createMockRes();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(mockIsRedisAvailable).not.toHaveBeenCalled();
    expect(mockGetFromCache).not.toHaveBeenCalled();
  });

  it('generates cache key from path and query params', async () => {
    mockGetFromCache.mockResolvedValue(null);

    const middleware = cacheMiddleware({ prefix: 'products', ttl: 600 });
    const req = createMockReq({
      path: '/api/products',
      query: { brand: 'Dell', condition: 'NEW' },
    });
    const res = createMockRes();

    await middleware(req, res, next);

    expect(mockGenerateCacheKey).toHaveBeenCalledWith('products', {
      path: '/api/products',
      brand: 'Dell',
      condition: 'NEW',
    });
  });

  it('does not cache error responses', async () => {
    mockGetFromCache.mockResolvedValue(null);

    const middleware = cacheMiddleware({ prefix: 'products', ttl: 600 });
    const req = createMockReq();
    const res = createMockRes();

    await middleware(req, res, next);

    // Simulate an error response
    res.statusCode = 400;
    const errorData = { error: 'Bad Request' };
    res.json(errorData);

    // Wait for any async operations
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockSetInCache).not.toHaveBeenCalled();
  });

  it('uses the configured TTL when caching', async () => {
    mockGetFromCache.mockResolvedValue(null);

    const middleware = cacheMiddleware({ prefix: 'filters', ttl: 3600 });
    const req = createMockReq();
    const res = createMockRes();

    await middleware(req, res, next);

    // Simulate successful response
    const data = { options: ['Dell', 'HP'] };
    res.json(data);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(mockSetInCache).toHaveBeenCalledWith(
      expect.any(String),
      data,
      3600,
    );
  });
});
