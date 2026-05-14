import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import { loginRateLimiter, incrementLoginAttempts, clearLoginAttempts } from './rateLimit.js';

// Mock redis module
vi.mock('../lib/redis.js', () => ({
  redis: {
    get: vi.fn(),
    ttl: vi.fn(),
    del: vi.fn(),
    multi: vi.fn(() => ({
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    })),
  },
  isRedisAvailable: vi.fn(),
}));

import { redis, isRedisAvailable } from '../lib/redis.js';
import { RateLimitError } from '../utils/errors.js';

const mockRedis = vi.mocked(redis);
const mockIsRedisAvailable = vi.mocked(isRedisAvailable);

function createMockReq(body: Record<string, unknown> = {}): Request {
  return { body } as unknown as Request;
}

function createMockRes(): Response {
  return {} as unknown as Response;
}

describe('loginRateLimiter', () => {
  let next: NextFunction;

  beforeEach(() => {
    vi.clearAllMocks();
    next = vi.fn();
    mockIsRedisAvailable.mockResolvedValue(true);
  });

  it('allows request when under the rate limit', async () => {
    mockRedis.get.mockResolvedValue('3');

    const req = createMockReq({ email: 'user@example.com' });
    const res = createMockRes();

    await loginRateLimiter(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('allows request when no attempts recorded', async () => {
    mockRedis.get.mockResolvedValue(null);

    const req = createMockReq({ email: 'user@example.com' });
    const res = createMockRes();

    await loginRateLimiter(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('blocks request with RateLimitError when at the limit (5 attempts)', async () => {
    mockRedis.get.mockResolvedValue('5');
    mockRedis.ttl.mockResolvedValue(600);

    const req = createMockReq({ email: 'user@example.com' });
    const res = createMockRes();

    await loginRateLimiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.retryAfter).toBe(600);
  });

  it('blocks request when over the limit (more than 5 attempts)', async () => {
    mockRedis.get.mockResolvedValue('10');
    mockRedis.ttl.mockResolvedValue(300);

    const req = createMockReq({ email: 'user@example.com' });
    const res = createMockRes();

    await loginRateLimiter(req, res, next);

    const error = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.retryAfter).toBe(300);
  });

  it('includes correct Retry-After value from Redis TTL', async () => {
    mockRedis.get.mockResolvedValue('5');
    mockRedis.ttl.mockResolvedValue(842);

    const req = createMockReq({ email: 'user@example.com' });
    const res = createMockRes();

    await loginRateLimiter(req, res, next);

    const error = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.retryAfter).toBe(842);
  });

  it('uses default window when TTL is negative (key has no expiry)', async () => {
    mockRedis.get.mockResolvedValue('5');
    mockRedis.ttl.mockResolvedValue(-1);

    const req = createMockReq({ email: 'user@example.com' });
    const res = createMockRes();

    await loginRateLimiter(req, res, next);

    const error = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.retryAfter).toBe(900);
  });

  it('gracefully skips rate limiting when Redis is unavailable', async () => {
    mockIsRedisAvailable.mockResolvedValue(false);

    const req = createMockReq({ email: 'user@example.com' });
    const res = createMockRes();

    await loginRateLimiter(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledTimes(1);
    expect(mockRedis.get).not.toHaveBeenCalled();
  });

  it('gracefully skips rate limiting when Redis throws an error', async () => {
    mockIsRedisAvailable.mockResolvedValue(true);
    mockRedis.get.mockRejectedValue(new Error('Connection refused'));

    const req = createMockReq({ email: 'user@example.com' });
    const res = createMockRes();

    await loginRateLimiter(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('skips rate limiting when no email in request body', async () => {
    const req = createMockReq({});
    const res = createMockRes();

    await loginRateLimiter(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(mockIsRedisAvailable).not.toHaveBeenCalled();
  });

  it('skips rate limiting when email is not a string', async () => {
    const req = createMockReq({ email: 123 });
    const res = createMockRes();

    await loginRateLimiter(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(mockIsRedisAvailable).not.toHaveBeenCalled();
  });
});

describe('incrementLoginAttempts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRedisAvailable.mockResolvedValue(true);
  });

  it('increments the counter with atomic MULTI command', async () => {
    const mockExec = vi.fn().mockResolvedValue([]);
    const mockExpire = vi.fn().mockReturnValue({ exec: mockExec });
    const mockIncr = vi.fn().mockReturnValue({ expire: mockExpire });
    mockRedis.multi.mockReturnValue({ incr: mockIncr } as never);

    await incrementLoginAttempts('user@example.com');

    expect(mockRedis.multi).toHaveBeenCalled();
    expect(mockIncr).toHaveBeenCalledWith('auth:attempts:user@example.com');
    expect(mockExpire).toHaveBeenCalledWith('auth:attempts:user@example.com', 900);
    expect(mockExec).toHaveBeenCalled();
  });

  it('does nothing when Redis is unavailable', async () => {
    mockIsRedisAvailable.mockResolvedValue(false);

    await incrementLoginAttempts('user@example.com');

    expect(mockRedis.multi).not.toHaveBeenCalled();
  });

  it('silently handles Redis errors', async () => {
    mockIsRedisAvailable.mockResolvedValue(true);
    mockRedis.multi.mockImplementation(() => {
      throw new Error('Connection lost');
    });

    // Should not throw
    await expect(incrementLoginAttempts('user@example.com')).resolves.toBeUndefined();
  });
});

describe('clearLoginAttempts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRedisAvailable.mockResolvedValue(true);
  });

  it('deletes the rate limit key', async () => {
    mockRedis.del.mockResolvedValue(1 as never);

    await clearLoginAttempts('user@example.com');

    expect(mockRedis.del).toHaveBeenCalledWith('auth:attempts:user@example.com');
  });

  it('does nothing when Redis is unavailable', async () => {
    mockIsRedisAvailable.mockResolvedValue(false);

    await clearLoginAttempts('user@example.com');

    expect(mockRedis.del).not.toHaveBeenCalled();
  });

  it('silently handles Redis errors', async () => {
    mockIsRedisAvailable.mockResolvedValue(true);
    mockRedis.del.mockRejectedValue(new Error('Connection lost'));

    // Should not throw
    await expect(clearLoginAttempts('user@example.com')).resolves.toBeUndefined();
  });
});
