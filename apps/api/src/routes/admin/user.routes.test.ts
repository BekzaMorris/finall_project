import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { errorHandler } from '../../middleware/errorHandler.js';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('../../lib/redis.js', () => ({
  redis: {
    scan: vi.fn(),
    mget: vi.fn(),
    del: vi.fn(),
  },
}));

import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { adminUserRouter } from './user.routes.js';

const mockPrisma = prisma as unknown as {
  user: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

const mockRedis = redis as unknown as {
  scan: ReturnType<typeof vi.fn>;
  mget: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
};

// ─── Test Helpers ────────────────────────────────────────────────────────────

function createAdminToken(userId = 'admin-1'): string {
  return jwt.sign(
    { userId, email: 'admin@example.com', role: 'ADMIN' },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' },
  );
}

function createClientToken(userId = 'client-1'): string {
  return jwt.sign(
    { userId, email: 'client@example.com', role: 'CLIENT' },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '15m' },
  );
}

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/users', adminUserRouter);
  app.use(errorHandler);
  return app;
}

const mockUser = {
  id: 'user-2',
  email: 'user@example.com',
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

describe('Admin User Routes', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createTestApp();
    // Default: Redis scan returns no keys
    mockRedis.scan.mockResolvedValue(['0', []]);
  });

  describe('GET /api/admin/users', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).get('/api/admin/users');
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-admin users', async () => {
      const token = createClientToken();
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('returns paginated user list for admin', async () => {
      const users = [mockUser];
      mockPrisma.user.findMany.mockResolvedValue(users);
      mockPrisma.user.count.mockResolvedValue(1);

      const token = createAdminToken();
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].id).toBe('user-2');
      expect(res.body.nextCursor).toBeNull();
      expect(res.body.totalCount).toBe(1);
    });

    it('supports cursor-based pagination', async () => {
      const users = Array.from({ length: 21 }, (_, i) => ({
        ...mockUser,
        id: `user-${i}`,
      }));
      mockPrisma.user.findMany.mockResolvedValue(users);
      mockPrisma.user.count.mockResolvedValue(50);

      const token = createAdminToken();
      const res = await request(app)
        .get('/api/admin/users?limit=20')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(20);
      expect(res.body.nextCursor).toBe('user-19');
    });

    it('supports role filter', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      const token = createAdminToken();
      const res = await request(app)
        .get('/api/admin/users?role=MANAGER')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: 'MANAGER' }),
        }),
      );
    });

    it('supports isActive filter', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      const token = createAdminToken();
      const res = await request(app)
        .get('/api/admin/users?isActive=true')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        }),
      );
    });

    it('rejects invalid limit values', async () => {
      const token = createAdminToken();
      const res = await request(app)
        .get('/api/admin/users?limit=200')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/admin/users/:id/role', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app)
        .patch('/api/admin/users/user-2/role')
        .send({ role: 'MANAGER' });
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-admin users', async () => {
      const token = createClientToken();
      const res = await request(app)
        .patch('/api/admin/users/user-2/role')
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'MANAGER' });
      expect(res.status).toBe(403);
    });

    it('returns 403 when admin tries to change own role', async () => {
      const token = createAdminToken('admin-1');
      const res = await request(app)
        .patch('/api/admin/users/admin-1/role')
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'CLIENT' });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Cannot change your own role');
    });

    it('returns 404 when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const token = createAdminToken();
      const res = await request(app)
        .patch('/api/admin/users/nonexistent/role')
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'MANAGER' });

      expect(res.status).toBe(404);
    });

    it('updates user role successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-2' });
      mockPrisma.user.update.mockResolvedValue({
        ...mockUser,
        role: 'MANAGER',
      });
      mockRedis.del.mockResolvedValue(1);

      const token = createAdminToken();
      const res = await request(app)
        .patch('/api/admin/users/user-2/role')
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'MANAGER' });

      expect(res.status).toBe(200);
      expect(res.body.role).toBe('MANAGER');
      expect(mockRedis.del).toHaveBeenCalledWith('permissions:user-2');
    });

    it('rejects invalid role values', async () => {
      const token = createAdminToken();
      const res = await request(app)
        .patch('/api/admin/users/user-2/role')
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'SUPERADMIN' });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/admin/users/:id/deactivate', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).patch('/api/admin/users/user-2/deactivate');
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-admin users', async () => {
      const token = createClientToken();
      const res = await request(app)
        .patch('/api/admin/users/user-2/deactivate')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('returns 403 when admin tries to deactivate own account', async () => {
      const token = createAdminToken('admin-1');
      const res = await request(app)
        .patch('/api/admin/users/admin-1/deactivate')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Cannot deactivate your own account');
    });

    it('returns 404 when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const token = createAdminToken();
      const res = await request(app)
        .patch('/api/admin/users/nonexistent/deactivate')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('deactivates user and revokes refresh tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-2' });
      mockPrisma.user.update.mockResolvedValue({
        ...mockUser,
        isActive: false,
      });
      // Simulate Redis scan finding tokens for this user
      mockRedis.scan.mockResolvedValueOnce(['0', ['refresh:token-1', 'refresh:token-2']]);
      mockRedis.mget.mockResolvedValueOnce(['user-2', 'other-user']);
      mockRedis.del.mockResolvedValue(1);

      const token = createAdminToken();
      const res = await request(app)
        .patch('/api/admin/users/user-2/deactivate')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(false);
      // Should only delete the token belonging to user-2
      expect(mockRedis.del).toHaveBeenCalledWith('refresh:token-1');
    });
  });

  describe('PATCH /api/admin/users/:id/activate', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).patch('/api/admin/users/user-2/activate');
      expect(res.status).toBe(401);
    });

    it('returns 403 for non-admin users', async () => {
      const token = createClientToken();
      const res = await request(app)
        .patch('/api/admin/users/user-2/activate')
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('returns 404 when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const token = createAdminToken();
      const res = await request(app)
        .patch('/api/admin/users/nonexistent/activate')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });

    it('activates user successfully', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-2' });
      mockPrisma.user.update.mockResolvedValue({
        ...mockUser,
        isActive: true,
      });

      const token = createAdminToken();
      const res = await request(app)
        .patch('/api/admin/users/user-2/activate')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.isActive).toBe(true);
    });
  });
});
