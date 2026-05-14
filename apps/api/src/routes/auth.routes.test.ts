import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

// Mock dependencies
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('../lib/redis.js', () => ({
  redis: {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    ttl: vi.fn(),
    multi: vi.fn(() => ({
      incr: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: vi.fn().mockResolvedValue([]),
    })),
  },
  isRedisAvailable: vi.fn(),
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
  },
}));

import { prisma } from '../lib/prisma.js';
import { redis, isRedisAvailable } from '../lib/redis.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const mockPrisma = vi.mocked(prisma);
const mockRedis = vi.mocked(redis);
const mockIsRedisAvailable = vi.mocked(isRedisAvailable);
const mockBcrypt = vi.mocked(bcrypt);
const mockJwt = vi.mocked(jwt);

const app = createApp();

// ─── Test Data ───────────────────────────────────────────────────────────────

const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  password: '$2b$12$hashedpassword',
  name: 'Test User',
  company: null,
  phone: null,
  role: 'CLIENT',
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockSafeUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  company: null,
  phone: null,
  role: 'CLIENT',
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Auth Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsRedisAvailable.mockResolvedValue(true);
    mockRedis.get.mockResolvedValue(null);
  });

  // ─── POST /api/auth/register ─────────────────────────────────────────────

  describe('POST /api/auth/register', () => {
    const validBody = {
      email: 'newuser@example.com',
      password: 'Password1',
      name: 'New User',
    };

    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        ...mockUser,
        email: validBody.email,
        name: validBody.name,
      });
      mockBcrypt.hash.mockResolvedValue('$2b$12$hashed' as never);
      mockJwt.sign.mockReturnValue('mock-access-token' as never);
      mockRedis.setex.mockResolvedValue('OK');
    });

    it('returns 201 with user and tokens on successful registration', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(validBody);

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(validBody.email);
      expect(res.body.tokens).toBeDefined();
      expect(res.body.tokens.accessToken).toBeDefined();
      expect(res.body.tokens.refreshToken).toBeDefined();
      expect(res.body.tokens.expiresIn).toBe(900);
    });

    it('sets refresh token as httpOnly cookie', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(validBody);

      expect(res.status).toBe(201);
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const refreshCookie = Array.isArray(cookies)
        ? cookies.find((c: string) => c.includes('refreshToken'))
        : cookies?.includes('refreshToken') ? cookies : undefined;
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
      expect(refreshCookie).toContain('Path=/api/auth');
    });

    it('registers with optional company and phone fields', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...validBody, company: 'Acme Corp', phone: '+1234567890' });

      expect(res.status).toBe(201);
    });

    it('returns 400 for invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...validBody, email: 'not-an-email' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
      expect(res.body.fields).toBeDefined();
    });

    it('returns 400 for email exceeding 255 characters', async () => {
      const longEmail = 'a'.repeat(250) + '@b.com';
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...validBody, email: longEmail });

      expect(res.status).toBe(400);
    });

    it('returns 400 for password shorter than 8 characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...validBody, password: 'Short1' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for password without uppercase letter', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...validBody, password: 'password1' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for password without lowercase letter', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...validBody, password: 'PASSWORD1' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for password without digit', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...validBody, password: 'Passwordd' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for name shorter than 2 characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...validBody, name: 'A' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for name exceeding 100 characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ ...validBody, name: 'A'.repeat(101) });

      expect(res.status).toBe(400);
    });

    it('returns 409 when email is already registered', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as never);

      const res = await request(app)
        .post('/api/auth/register')
        .send(validBody);

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Email is already registered');
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'test@example.com' });

      expect(res.status).toBe(400);
    });
  });

  // ─── POST /api/auth/login ────────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    const validBody = {
      email: 'test@example.com',
      password: 'Password1',
    };

    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as never);
      mockPrisma.user.update.mockResolvedValue(mockUser as never);
      mockBcrypt.compare.mockResolvedValue(true as never);
      mockJwt.sign.mockReturnValue('mock-access-token' as never);
      mockRedis.setex.mockResolvedValue('OK');
      mockRedis.del.mockResolvedValue(1 as never);
    });

    it('returns 200 with user and tokens on successful login', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send(validBody);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe(validBody.email);
      expect(res.body.tokens).toBeDefined();
      expect(res.body.tokens.accessToken).toBeDefined();
      expect(res.body.tokens.refreshToken).toBeDefined();
    });

    it('sets refresh token as httpOnly cookie on login', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send(validBody);

      expect(res.status).toBe(200);
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const refreshCookie = Array.isArray(cookies)
        ? cookies.find((c: string) => c.includes('refreshToken'))
        : cookies?.includes('refreshToken') ? cookies : undefined;
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain('HttpOnly');
    });

    it('clears login attempts on successful login', async () => {
      await request(app)
        .post('/api/auth/login')
        .send(validBody);

      expect(mockRedis.del).toHaveBeenCalledWith('auth:attempts:test@example.com');
    });

    it('returns generic "Invalid credentials" on wrong password', async () => {
      mockBcrypt.compare.mockResolvedValue(false as never);

      const res = await request(app)
        .post('/api/auth/login')
        .send(validBody);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('returns generic "Invalid credentials" for non-existent email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockBcrypt.compare.mockResolvedValue(false as never);

      const res = await request(app)
        .post('/api/auth/login')
        .send(validBody);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('increments login attempts on failed login', async () => {
      mockBcrypt.compare.mockResolvedValue(false as never);

      await request(app)
        .post('/api/auth/login')
        .send(validBody);

      expect(mockRedis.multi).toHaveBeenCalled();
    });

    it('returns 429 when rate limited', async () => {
      mockRedis.get.mockResolvedValue('5');
      mockRedis.ttl.mockResolvedValue(600);

      const res = await request(app)
        .post('/api/auth/login')
        .send(validBody);

      expect(res.status).toBe(429);
      expect(res.headers['retry-after']).toBe('600');
    });

    it('returns 400 for invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'not-valid', password: 'Password1' });

      expect(res.status).toBe(400);
    });

    it('returns 400 for empty password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: '' });

      expect(res.status).toBe(400);
    });
  });

  // ─── POST /api/auth/refresh ──────────────────────────────────────────────

  describe('POST /api/auth/refresh', () => {
    beforeEach(() => {
      mockRedis.get.mockResolvedValue('user-123');
      mockRedis.del.mockResolvedValue(1 as never);
      mockRedis.setex.mockResolvedValue('OK');
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as never);
      mockJwt.sign.mockReturnValue('new-access-token' as never);
    });

    it('returns 200 with new token pair when valid refresh token in cookie', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', 'refreshToken=valid-refresh-token');

      expect(res.status).toBe(200);
      expect(res.body.tokens).toBeDefined();
      expect(res.body.tokens.accessToken).toBeDefined();
      expect(res.body.tokens.refreshToken).toBeDefined();
    });

    it('sets new refresh token cookie after rotation', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', 'refreshToken=valid-refresh-token');

      expect(res.status).toBe(200);
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
    });

    it('returns 401 when no refresh token cookie is present', async () => {
      const res = await request(app)
        .post('/api/auth/refresh');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Refresh token not found');
    });

    it('returns 401 when refresh token is invalid/expired', async () => {
      mockRedis.get.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', 'refreshToken=invalid-token');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired refresh token');
    });
  });

  // ─── POST /api/auth/logout ───────────────────────────────────────────────

  describe('POST /api/auth/logout', () => {
    beforeEach(() => {
      mockRedis.del.mockResolvedValue(1 as never);
    });

    it('returns 200 with logout message and clears cookie', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', 'refreshToken=some-token');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logged out');
      // Cookie should be cleared
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      const refreshCookie = Array.isArray(cookies)
        ? cookies.find((c: string) => c.includes('refreshToken'))
        : cookies;
      expect(refreshCookie).toContain('refreshToken=');
    });

    it('revokes the refresh token in Redis', async () => {
      await request(app)
        .post('/api/auth/logout')
        .set('Cookie', 'refreshToken=some-token');

      expect(mockRedis.del).toHaveBeenCalledWith('refresh:some-token');
    });

    it('returns 200 even without a refresh token cookie', async () => {
      const res = await request(app)
        .post('/api/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logged out');
    });
  });

  // ─── GET /api/auth/me ────────────────────────────────────────────────────

  describe('GET /api/auth/me', () => {
    beforeEach(() => {
      mockJwt.verify.mockReturnValue({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'CLIENT',
      } as never);
      mockPrisma.user.findUnique.mockResolvedValue(mockUser as never);
    });

    it('returns 200 with user data when authenticated', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('test@example.com');
      expect(res.body.name).toBe('Test User');
      // Should not include password
      expect(res.body.password).toBeUndefined();
      expect(res.body.passwordHash).toBeUndefined();
    });

    it('returns 401 when no Authorization header is provided', async () => {
      const res = await request(app)
        .get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Authentication required');
    });

    it('returns 401 when token is invalid', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid or expired token');
    });

    it('returns 401 when Authorization header has wrong format', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Basic some-credentials');

      expect(res.status).toBe(401);
    });

    it('returns 404 when user no longer exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('User not found');
    });
  });
});
