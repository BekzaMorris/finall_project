import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// Mock prisma
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Mock redis
vi.mock('../lib/redis.js', () => ({
  redis: {
    setex: vi.fn().mockResolvedValue('OK'),
    get: vi.fn(),
    del: vi.fn().mockResolvedValue(1),
  },
}));

import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import {
  register,
  login,
  refreshToken,
  logout,
  getCurrentUser,
  verifyAccessToken,
} from './auth.service.js';

const mockPrisma = prisma as unknown as {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

const mockRedis = redis as unknown as {
  setex: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
};

// ─── Test Data ───────────────────────────────────────────────────────────────

const TEST_USER = {
  id: 'user-123',
  email: 'test@example.com',
  password: '', // Will be set in beforeEach
  name: 'Test User',
  company: 'Test Corp',
  phone: '+1234567890',
  role: 'CLIENT',
  isActive: true,
  lastLoginAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const TEST_PASSWORD = 'SecurePass123';

describe('Auth Service', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Pre-hash the test password for use in login tests
    TEST_USER.password = await bcrypt.hash(TEST_PASSWORD, 12);
  });

  // ─── Register ────────────────────────────────────────────────────────────

  describe('register', () => {
    it('creates a new user with CLIENT role and returns tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ ...TEST_USER, role: 'CLIENT' });

      const result = await register({
        email: 'new@example.com',
        password: TEST_PASSWORD,
        name: 'New User',
        company: 'New Corp',
        phone: '+1111111111',
      });

      // Verify user was created
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'new@example.com',
          name: 'New User',
          company: 'New Corp',
          phone: '+1111111111',
          role: 'CLIENT',
        }),
      });

      // Verify password was hashed (not stored in plain text)
      const createCall = mockPrisma.user.create.mock.calls[0]![0] as { data: { password: string } };
      expect(createCall.data.password).not.toBe(TEST_PASSWORD);
      expect(createCall.data.password).toMatch(/^\$2b\$12\$/);

      // Verify result structure
      expect(result.user).toBeDefined();
      expect(result.user).not.toHaveProperty('password');
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect(result.tokens.expiresIn).toBe(900);

      // Verify refresh token stored in Redis
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringMatching(/^refresh:/),
        604800, // 7 days
        TEST_USER.id,
      );

      // Verify access token is valid JWT
      const decoded = jwt.decode(result.tokens.accessToken) as Record<string, unknown>;
      expect(decoded).toHaveProperty('userId');
      expect(decoded).toHaveProperty('email');
      expect(decoded).toHaveProperty('role', 'CLIENT');
    });

    it('throws ConflictError when email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);

      await expect(
        register({
          email: 'test@example.com',
          password: TEST_PASSWORD,
          name: 'Duplicate User',
        }),
      ).rejects.toThrow('Email is already registered');
    });
  });

  // ─── Login ───────────────────────────────────────────────────────────────

  describe('login', () => {
    it('returns tokens for valid credentials', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);
      mockPrisma.user.update.mockResolvedValue(TEST_USER);

      const result = await login('test@example.com', TEST_PASSWORD);

      expect(result.user.id).toBe(TEST_USER.id);
      expect(result.user.email).toBe(TEST_USER.email);
      expect(result.user).not.toHaveProperty('password');
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
      expect(result.tokens.expiresIn).toBe(900);

      // Verify access token payload
      const decoded = jwt.decode(result.tokens.accessToken) as Record<string, unknown>;
      expect(decoded.userId).toBe(TEST_USER.id);
      expect(decoded.email).toBe(TEST_USER.email);
      expect(decoded.role).toBe(TEST_USER.role);

      // Verify lastLoginAt was updated
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: TEST_USER.id },
        data: { lastLoginAt: expect.any(Date) },
      });

      // Verify refresh token stored in Redis
      expect(mockRedis.setex).toHaveBeenCalledWith(
        expect.stringMatching(/^refresh:/),
        604800,
        TEST_USER.id,
      );
    });

    it('throws AuthenticationError with generic message for invalid email (timing-safe)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        login('nonexistent@example.com', TEST_PASSWORD),
      ).rejects.toThrow('Invalid credentials');

      // Verify no tokens were generated (no Redis call)
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('throws AuthenticationError with generic message for invalid password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);

      await expect(
        login('test@example.com', 'WrongPassword123'),
      ).rejects.toThrow('Invalid credentials');

      // Verify no tokens were generated
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('throws AuthenticationError for inactive user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        ...TEST_USER,
        isActive: false,
      });

      await expect(
        login('test@example.com', TEST_PASSWORD),
      ).rejects.toThrow('Invalid credentials');

      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('performs bcrypt comparison even when user not found (timing attack prevention)', async () => {
      const bcryptCompareSpy = vi.spyOn(bcrypt, 'compare');
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        login('nonexistent@example.com', 'anypassword'),
      ).rejects.toThrow('Invalid credentials');

      // bcrypt.compare should still be called with the dummy hash
      expect(bcryptCompareSpy).toHaveBeenCalledWith(
        'anypassword',
        expect.stringMatching(/^\$2b\$12\$/),
      );

      bcryptCompareSpy.mockRestore();
    });
  });

  // ─── Refresh Token ───────────────────────────────────────────────────────

  describe('refreshToken', () => {
    it('issues new token pair and invalidates old token (rotation)', async () => {
      const oldToken = 'old-refresh-token-uuid';
      mockRedis.get.mockResolvedValue(TEST_USER.id);
      mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);

      const result = await refreshToken(oldToken);

      // Old token should be deleted
      expect(mockRedis.del).toHaveBeenCalledWith(`refresh:${oldToken}`);

      // New tokens should be returned
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.refreshToken).not.toBe(oldToken);
      expect(result.expiresIn).toBe(900);

      // New refresh token should be stored in Redis
      expect(mockRedis.setex).toHaveBeenCalledWith(
        `refresh:${result.refreshToken}`,
        604800,
        TEST_USER.id,
      );

      // Verify access token payload
      const decoded = jwt.decode(result.accessToken) as Record<string, unknown>;
      expect(decoded.userId).toBe(TEST_USER.id);
      expect(decoded.email).toBe(TEST_USER.email);
      expect(decoded.role).toBe(TEST_USER.role);
    });

    it('throws AuthenticationError for invalid/expired token', async () => {
      mockRedis.get.mockResolvedValue(null);

      await expect(
        refreshToken('invalid-token'),
      ).rejects.toThrow('Invalid or expired refresh token');
    });

    it('throws AuthenticationError when user no longer exists', async () => {
      mockRedis.get.mockResolvedValue('deleted-user-id');
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        refreshToken('valid-token-deleted-user'),
      ).rejects.toThrow('Invalid or expired refresh token');
    });

    it('throws AuthenticationError when user is inactive', async () => {
      mockRedis.get.mockResolvedValue(TEST_USER.id);
      mockPrisma.user.findUnique.mockResolvedValue({
        ...TEST_USER,
        isActive: false,
      });

      await expect(
        refreshToken('valid-token-inactive-user'),
      ).rejects.toThrow('Invalid or expired refresh token');
    });
  });

  // ─── Logout ──────────────────────────────────────────────────────────────

  describe('logout', () => {
    it('revokes refresh token from Redis', async () => {
      const token = 'refresh-token-to-revoke';

      await logout(token);

      expect(mockRedis.del).toHaveBeenCalledWith(`refresh:${token}`);
    });
  });

  // ─── getCurrentUser ──────────────────────────────────────────────────────

  describe('getCurrentUser', () => {
    it('returns user without password hash', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);

      const result = await getCurrentUser(TEST_USER.id);

      expect(result).toBeDefined();
      expect(result!.id).toBe(TEST_USER.id);
      expect(result!.email).toBe(TEST_USER.email);
      expect(result).not.toHaveProperty('password');
    });

    it('returns null for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await getCurrentUser('non-existent-id');

      expect(result).toBeNull();
    });
  });

  // ─── verifyAccessToken ───────────────────────────────────────────────────

  describe('verifyAccessToken', () => {
    it('returns payload for valid token', () => {
      const token = jwt.sign(
        { userId: 'user-1', email: 'test@example.com', role: 'CLIENT' },
        env.JWT_ACCESS_SECRET,
        { expiresIn: '15m' },
      );

      const result = verifyAccessToken(token);

      expect(result).not.toBeNull();
      expect(result!.userId).toBe('user-1');
      expect(result!.email).toBe('test@example.com');
      expect(result!.role).toBe('CLIENT');
    });

    it('returns null for invalid token', () => {
      const result = verifyAccessToken('invalid-token');
      expect(result).toBeNull();
    });

    it('returns null for expired token', () => {
      const token = jwt.sign(
        { userId: 'user-1', email: 'test@example.com', role: 'CLIENT' },
        env.JWT_ACCESS_SECRET,
        { expiresIn: '-1s' },
      );

      const result = verifyAccessToken(token);
      expect(result).toBeNull();
    });
  });
});
