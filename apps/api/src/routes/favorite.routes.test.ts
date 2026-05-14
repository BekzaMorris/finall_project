import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../app.js';

// Mock dependencies
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    favorite: {
      findMany: vi.fn(),
      count: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../lib/redis.js', () => ({
  redis: {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
    ttl: vi.fn(),
  },
  isRedisAvailable: vi.fn(),
}));

vi.mock('jsonwebtoken', () => ({
  default: {
    sign: vi.fn(),
    verify: vi.fn(),
  },
}));

import { prisma } from '../lib/prisma.js';
import jwt from 'jsonwebtoken';

const mockPrisma = vi.mocked(prisma);
const mockJwt = vi.mocked(jwt);

const app = createApp();

// ─── Test Data ───────────────────────────────────────────────────────────────

const mockUserPayload = {
  userId: 'user-123',
  email: 'test@example.com',
  role: 'CLIENT',
};

const mockProduct = {
  id: 'product-1',
  name: 'Dell PowerEdge R740',
  slug: 'dell-poweredge-r740',
  price: 2999.99,
  stockStatus: 'IN_STOCK',
  condition: 'NEW',
  isActive: true,
  images: [{ id: 'img-1', url: 'https://example.com/img.jpg', alt: 'Server' }],
};

const mockFavorite = {
  id: 'fav-1',
  userId: 'user-123',
  productId: 'product-1',
  createdAt: new Date('2024-01-15'),
  product: {
    id: 'product-1',
    name: 'Dell PowerEdge R740',
    slug: 'dell-poweredge-r740',
    price: 2999.99,
    stockStatus: 'IN_STOCK',
    condition: 'NEW',
    images: [{ id: 'img-1', url: 'https://example.com/img.jpg', alt: 'Server' }],
  },
};

// ─── Helper ──────────────────────────────────────────────────────────────────

function authenticatedRequest() {
  mockJwt.verify.mockReturnValue(mockUserPayload as never);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Favorite Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── GET /api/favorites ──────────────────────────────────────────────────

  describe('GET /api/favorites', () => {
    beforeEach(() => {
      authenticatedRequest();
    });

    it('returns 200 with paginated favorites list', async () => {
      mockPrisma.favorite.findMany.mockResolvedValue([mockFavorite] as never);
      mockPrisma.favorite.count.mockResolvedValue(1);

      const res = await request(app)
        .get('/api/favorites')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].product.name).toBe('Dell PowerEdge R740');
      expect(res.body.totalCount).toBe(1);
      expect(res.body.nextCursor).toBeNull();
    });

    it('returns empty list when user has no favorites', async () => {
      mockPrisma.favorite.findMany.mockResolvedValue([]);
      mockPrisma.favorite.count.mockResolvedValue(0);

      const res = await request(app)
        .get('/api/favorites')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(0);
      expect(res.body.totalCount).toBe(0);
      expect(res.body.nextCursor).toBeNull();
    });

    it('supports cursor-based pagination', async () => {
      // Return limit+1 items to indicate there's a next page
      const favorites = [
        { ...mockFavorite, id: 'fav-1' },
        { ...mockFavorite, id: 'fav-2' },
        { ...mockFavorite, id: 'fav-3' },
      ];
      mockPrisma.favorite.findMany.mockResolvedValue(favorites as never);
      mockPrisma.favorite.count.mockResolvedValue(5);

      const res = await request(app)
        .get('/api/favorites?limit=2')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(2);
      expect(res.body.nextCursor).toBe('fav-2');
    });

    it('accepts cursor query parameter', async () => {
      mockPrisma.favorite.findMany.mockResolvedValue([mockFavorite] as never);
      mockPrisma.favorite.count.mockResolvedValue(1);

      const res = await request(app)
        .get('/api/favorites?cursor=fav-0&limit=10')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(mockPrisma.favorite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'fav-0' },
          skip: 1,
        }),
      );
    });

    it('excludes products where isActive is false', async () => {
      mockPrisma.favorite.findMany.mockResolvedValue([]);
      mockPrisma.favorite.count.mockResolvedValue(0);

      await request(app)
        .get('/api/favorites')
        .set('Authorization', 'Bearer valid-token');

      expect(mockPrisma.favorite.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            product: { isActive: true },
          }),
        }),
      );
    });

    it('returns 400 for invalid limit parameter', async () => {
      const res = await request(app)
        .get('/api/favorites?limit=0')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(400);
    });

    it('returns 400 for limit exceeding 100', async () => {
      const res = await request(app)
        .get('/api/favorites?limit=101')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(400);
    });

    it('returns 401 when not authenticated', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      const res = await request(app).get('/api/favorites');

      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/favorites/:productId ──────────────────────────────────────

  describe('POST /api/favorites/:productId', () => {
    beforeEach(() => {
      authenticatedRequest();
    });

    it('returns 201 when adding a product to favorites', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct as never);
      mockPrisma.favorite.upsert.mockResolvedValue(mockFavorite as never);

      const res = await request(app)
        .post('/api/favorites/product-1')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Added to favorites');
    });

    it('is idempotent - returns 201 even if already favorited', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct as never);
      mockPrisma.favorite.upsert.mockResolvedValue(mockFavorite as never);

      // First add
      const res1 = await request(app)
        .post('/api/favorites/product-1')
        .set('Authorization', 'Bearer valid-token');
      expect(res1.status).toBe(201);

      // Second add (idempotent)
      const res2 = await request(app)
        .post('/api/favorites/product-1')
        .set('Authorization', 'Bearer valid-token');
      expect(res2.status).toBe(201);
    });

    it('uses upsert to prevent duplicates', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(mockProduct as never);
      mockPrisma.favorite.upsert.mockResolvedValue(mockFavorite as never);

      await request(app)
        .post('/api/favorites/product-1')
        .set('Authorization', 'Bearer valid-token');

      expect(mockPrisma.favorite.upsert).toHaveBeenCalledWith({
        where: {
          userId_productId: { userId: 'user-123', productId: 'product-1' },
        },
        create: { userId: 'user-123', productId: 'product-1' },
        update: {},
      });
    });

    it('returns 404 when product does not exist', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/favorites/nonexistent-product')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(404);
    });

    it('returns 404 when product is inactive (soft-deleted)', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({
        ...mockProduct,
        isActive: false,
      } as never);

      const res = await request(app)
        .post('/api/favorites/product-1')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(404);
    });

    it('returns 401 when not authenticated', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      const res = await request(app).post('/api/favorites/product-1');

      expect(res.status).toBe(401);
    });
  });

  // ─── DELETE /api/favorites/:productId ────────────────────────────────────

  describe('DELETE /api/favorites/:productId', () => {
    beforeEach(() => {
      authenticatedRequest();
    });

    it('returns 200 when removing a product from favorites', async () => {
      mockPrisma.favorite.deleteMany.mockResolvedValue({ count: 1 } as never);

      const res = await request(app)
        .delete('/api/favorites/product-1')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Removed from favorites');
    });

    it('is idempotent - returns 200 even if not in favorites', async () => {
      mockPrisma.favorite.deleteMany.mockResolvedValue({ count: 0 } as never);

      const res = await request(app)
        .delete('/api/favorites/product-1')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Removed from favorites');
    });

    it('calls deleteMany with correct userId and productId', async () => {
      mockPrisma.favorite.deleteMany.mockResolvedValue({ count: 1 } as never);

      await request(app)
        .delete('/api/favorites/product-1')
        .set('Authorization', 'Bearer valid-token');

      expect(mockPrisma.favorite.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', productId: 'product-1' },
      });
    });

    it('returns 401 when not authenticated', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      const res = await request(app).delete('/api/favorites/product-1');

      expect(res.status).toBe(401);
    });
  });
});
