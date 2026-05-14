import { Redis } from 'ioredis';
import { env } from '../config/env.js';

/**
 * Redis client singleton with connection pooling via ioredis.
 * Handles connection errors gracefully (logs, doesn't crash).
 */

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient(): Redis {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times: number) {
      // Exponential backoff: 50ms, 100ms, 200ms... up to 2s
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    lazyConnect: false,
    enableReadyCheck: true,
  });

  client.on('error', (err: Error) => {
    console.error('[Redis] Connection error:', err.message);
  });

  client.on('connect', () => {
    console.log('[Redis] Connected successfully');
  });

  client.on('reconnecting', () => {
    console.log('[Redis] Reconnecting...');
  });

  return client;
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

/**
 * Checks whether the Redis connection is currently available and responsive.
 * Returns true if Redis is connected and responds to PING.
 */
export async function isRedisAvailable(): Promise<boolean> {
  try {
    if (redis.status !== 'ready') {
      return false;
    }
    const result = await redis.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

export default redis;
