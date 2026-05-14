import type { Request, Response, NextFunction } from 'express';
import { generateCacheKey, getFromCache, setInCache } from '../lib/cache.js';
import { isRedisAvailable } from '../lib/redis.js';

export interface CacheMiddlewareOptions {
  /** Cache key namespace prefix (e.g., "products", "filters") */
  prefix: string;
  /** Time-to-live in seconds */
  ttl: number;
}

/**
 * Express cache middleware factory.
 * Returns middleware that:
 * - Generates a cache key from request path + query params
 * - On cache hit: returns cached response immediately
 * - On cache miss: wraps res.json to intercept response, stores in cache, then sends
 * - Falls back to normal request processing if Redis is unavailable
 */
export function cacheMiddleware(options: CacheMiddlewareOptions) {
  const { prefix, ttl } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Skip caching for non-GET requests
    if (req.method !== 'GET') {
      next();
      return;
    }

    // Fall back to normal processing if Redis is unavailable
    if (!(await isRedisAvailable())) {
      next();
      return;
    }

    // Generate deterministic cache key from path + query params
    const params: Record<string, unknown> = {
      path: req.path,
      ...req.query,
    };
    const cacheKey = generateCacheKey(prefix, params);

    // Check cache
    const cached = await getFromCache<unknown>(cacheKey);
    if (cached !== null) {
      res.json(cached);
      return;
    }

    // Cache miss: intercept res.json to capture and cache the response
    const originalJson = res.json.bind(res);
    res.json = ((data: unknown) => {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        // Fire and forget - don't block the response
        setInCache(cacheKey, data, ttl).catch(() => {
          // Ignore cache write errors
        });
      }
      return originalJson(data);
    }) as Response['json'];

    next();
  };
}
