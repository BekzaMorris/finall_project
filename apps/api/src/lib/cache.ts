import { createHash } from 'node:crypto';
import { redis, isRedisAvailable } from './redis.js';

/**
 * Generates a deterministic cache key by sorting params alphabetically,
 * JSON.stringify, then SHA-256 hash (first 16 chars).
 *
 * @param prefix - Cache key namespace prefix (e.g., "products", "filters")
 * @param params - Parameters to hash for the key
 * @returns Deterministic cache key string: "{prefix}:{hash}"
 */
export function generateCacheKey(
  prefix: string,
  params: Record<string, unknown>,
): string {
  const sortedKeys = Object.keys(params).sort();
  const sortedObj: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    sortedObj[key] = params[key];
  }
  const json = JSON.stringify(sortedObj);
  const hash = createHash('sha256').update(json).digest('hex').slice(0, 16);
  return `${prefix}:${hash}`;
}

/**
 * Gets a value from Redis cache, parsed as JSON.
 * Returns null on cache miss or if Redis is unavailable.
 *
 * @param key - The cache key to look up
 * @returns Parsed value or null
 */
export async function getFromCache<T>(key: string): Promise<T | null> {
  try {
    if (!(await isRedisAvailable())) {
      return null;
    }
    const data = await redis.get(key);
    if (data === null) {
      return null;
    }
    return JSON.parse(data) as T;
  } catch {
    return null;
  }
}

/**
 * Sets a value in Redis cache with a TTL.
 * No-op if Redis is unavailable.
 *
 * @param key - The cache key
 * @param data - The data to cache (will be JSON.stringify'd)
 * @param ttlSeconds - Time-to-live in seconds
 */
export async function setInCache(
  key: string,
  data: unknown,
  ttlSeconds: number,
): Promise<void> {
  try {
    if (!(await isRedisAvailable())) {
      return;
    }
    const json = JSON.stringify(data);
    await redis.setex(key, ttlSeconds, json);
  } catch {
    // Gracefully ignore cache write failures
  }
}

/**
 * Deletes all keys matching a glob pattern.
 * No-op if Redis is unavailable.
 *
 * @param pattern - Glob pattern to match keys (e.g., "products:*")
 */
export async function invalidateByPattern(pattern: string): Promise<void> {
  try {
    if (!(await isRedisAvailable())) {
      return;
    }

    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch {
    // Gracefully ignore cache invalidation failures
  }
}
