import type { Request, Response, NextFunction } from 'express';
import { redis, isRedisAvailable } from '../lib/redis.js';
import { RateLimitError } from '../utils/errors.js';

const RATE_LIMIT_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_SECONDS = 900; // 15 minutes

/**
 * Generates the Redis key for tracking login attempts per email.
 */
function getRateLimitKey(email: string): string {
  return `auth:attempts:${email}`;
}

/**
 * Rate limiting middleware for login attempts.
 * Checks if the email has exceeded the maximum allowed failed attempts
 * within the rate limit window. If so, throws a RateLimitError.
 *
 * Gracefully skips rate limiting if Redis is unavailable.
 */
export async function loginRateLimiter(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const email = req.body?.email;

  // If no email in body, skip rate limiting (validation will catch it later)
  if (!email || typeof email !== 'string') {
    next();
    return;
  }

  try {
    const available = await isRedisAvailable();
    if (!available) {
      next();
      return;
    }

    const key = getRateLimitKey(email);
    const attempts = await redis.get(key);

    if (attempts && parseInt(attempts, 10) >= RATE_LIMIT_MAX_ATTEMPTS) {
      const ttl = await redis.ttl(key);
      const retryAfter = ttl > 0 ? ttl : RATE_LIMIT_WINDOW_SECONDS;
      throw new RateLimitError('Too many login attempts. Please try again later.', retryAfter);
    }

    next();
  } catch (err) {
    if (err instanceof RateLimitError) {
      next(err);
      return;
    }
    // Redis error — gracefully skip rate limiting
    next();
  }
}

/**
 * Increments the failed login attempt counter for the given email.
 * Uses Redis MULTI for atomic increment + expire.
 * Sets TTL to 900 seconds (15 minutes) if not already set.
 *
 * Gracefully does nothing if Redis is unavailable.
 */
export async function incrementLoginAttempts(email: string): Promise<void> {
  try {
    const available = await isRedisAvailable();
    if (!available) {
      return;
    }

    const key = getRateLimitKey(email);
    await redis.multi().incr(key).expire(key, RATE_LIMIT_WINDOW_SECONDS).exec();
  } catch {
    // Redis error — silently skip
  }
}

/**
 * Clears the rate limit counter for the given email.
 * Called on successful login to reset the attempt count.
 *
 * Gracefully does nothing if Redis is unavailable.
 */
export async function clearLoginAttempts(email: string): Promise<void> {
  try {
    const available = await isRedisAvailable();
    if (!available) {
      return;
    }

    const key = getRateLimitKey(email);
    await redis.del(key);
  } catch {
    // Redis error — silently skip
  }
}
