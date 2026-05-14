import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import type { Express } from 'express';

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    product: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('../../services/catalog-cache.service.js', () => ({
  invalidateProductCaches: vi.fn().mockResolvedValue(undefined),
  getCachedProducts: vi.fn().mockResolvedValue({ items: [], nextCursor: null, totalCount: 0 }),
  getCachedFilterOptions: vi.fn().mockResolvedValue({}),
  getCachedProductCount: vi.fn().mockResolvedValue(0),
}));

vi.mock('../../services/auth.service.js', () => ({
  verifyAccessToken: vi.fn(),
}));

vi.mock('../../utils/slug.js', () => ({
  generateSlug: vi.fn((name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')),
  generateUniqueSlug: vi.fn().mockResolvedValue('test-product-slug'),
}));

import { prisma } from '../../lib/prisma.js';
import { invalidateProductCaches } from '../../services/catalog-cache.service.js';
import { verifyAccessToken } from '../../services/auth.service.js';
import { generateUniqueSlug } from '../../utils/slug.js';

const mockPrisma = prisma as unknown as {
  product: {
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
};

// ─── Test Setup ──────────────────────────────────────────────────────────────

let app: Express;

beforeEach(() => {
  vi.clearAllMocks();
  app = createApp();
});

function setAuthToken(role: string) {
  (verifyAccessToken as ReturnType<typeof vi.fn>).mockReturnValue({
    userId: 'user-1',
    email: 'admin@test.com',
    role,
  });
}

const validProduct = {
  name: 'Dell PowerEdge R740',
  sku: 'PE-R740-001',
  brand: 'Dell',
  condition: 'NEW',
  price: 4999.99,
  stockStatus: 'IN_STOCK',
  cpuCores: 16,
  cpuCount: 2,
  ramGb: 128,
  unitCount: 2,
  psuWatt: 750,
};

const mockCreatedProduct = {
  id: 'prod-1',
  slug: 'test-product-slug',
  ...validProduct,
  customFields: {},
  isActive: true,
  isFeatured: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  images: [],
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Admin Product Routes', () => {
  describe('GET /api/admin/products', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).get('/api/admin/products');
      expect(res.status).toBe(401);
    });

    it('returns 403 for CLIENT role', async () => {
      setAuthToken('CLIENT');
      const res = await request(app)
        .get('/api/admin/products')
        .set('Authorization', 'Bearer valid-token');
      expect(res.status).toBe(403);
    });

    it('returns products for MANAGER role', async () => {
      setAuthToken('MANAGER');
      mockPrisma.product.findMany.mockResolvedValue([mockCreatedProduct]);
      mockPrisma.product.count.mockResolvedValue(1);

      const res = await request(app)
        .get('/api/admin/products')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.totalCount).toBe(1);
    });

    it('returns products for ADMIN role', async () => {
      setAuthToken('ADMIN');
      mockPrisma.product.findMany.mockResolvedValue([mockCreatedProduct]);
      mockPrisma.product.count.mockResolvedValue(1);

      const res = await request(app)
        .get('/api/admin/products')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(1);
    });

    it('supports search parameter', async () => {
      setAuthToken('ADMIN');
      mockPrisma.product.findMany.mockResolvedValue([]);
      mockPrisma.product.count.mockResolvedValue(0);

      const res = await request(app)
        .get('/api/admin/products?search=Dell')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: { contains: 'Dell', mode: 'insensitive' } }),
            ]),
          }),
        }),
      );
    });

    it('supports pagination with cursor', async () => {
      setAuthToken('ADMIN');
      mockPrisma.product.findMany.mockResolvedValue([]);
      mockPrisma.product.count.mockResolvedValue(0);

      const res = await request(app)
        .get('/api/admin/products?cursor=some-cursor-id&limit=10')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(mockPrisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 11, // limit + 1 for hasNext detection
          cursor: { id: 'some-cursor-id' },
          skip: 1,
        }),
      );
    });
  });

  describe('POST /api/admin/products', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app)
        .post('/api/admin/products')
        .send(validProduct);
      expect(res.status).toBe(401);
    });

    it('returns 403 for MANAGER role', async () => {
      setAuthToken('MANAGER');
      const res = await request(app)
        .post('/api/admin/products')
        .set('Authorization', 'Bearer valid-token')
        .send(validProduct);
      expect(res.status).toBe(403);
    });

    it('creates a product with valid data', async () => {
      setAuthToken('ADMIN');
      mockPrisma.product.create.mockResolvedValue(mockCreatedProduct);

      const res = await request(app)
        .post('/api/admin/products')
        .set('Authorization', 'Bearer valid-token')
        .send(validProduct);

      expect(res.status).toBe(201);
      expect(res.body.id).toBe('prod-1');
      expect(res.body.slug).toBe('test-product-slug');
      expect(generateUniqueSlug).toHaveBeenCalledWith('Dell PowerEdge R740', expect.anything());
      expect(invalidateProductCaches).toHaveBeenCalledWith('prod-1');
    });

    it('rejects invalid price (negative)', async () => {
      setAuthToken('ADMIN');
      const res = await request(app)
        .post('/api/admin/products')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...validProduct, price: -100 });

      expect(res.status).toBe(400);
    });

    it('rejects invalid CPU cores (> 128)', async () => {
      setAuthToken('ADMIN');
      const res = await request(app)
        .post('/api/admin/products')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...validProduct, cpuCores: 256 });

      expect(res.status).toBe(400);
    });

    it('rejects invalid RAM (not power of 2)', async () => {
      setAuthToken('ADMIN');
      const res = await request(app)
        .post('/api/admin/products')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...validProduct, ramGb: 100 });

      expect(res.status).toBe(400);
    });

    it('rejects invalid PSU wattage (< 100)', async () => {
      setAuthToken('ADMIN');
      const res = await request(app)
        .post('/api/admin/products')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...validProduct, psuWatt: 50 });

      expect(res.status).toBe(400);
    });

    it('rejects invalid unit count (> 48)', async () => {
      setAuthToken('ADMIN');
      const res = await request(app)
        .post('/api/admin/products')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...validProduct, unitCount: 100 });

      expect(res.status).toBe(400);
    });

    it('supports custom fields (JSONB)', async () => {
      setAuthToken('ADMIN');
      const customFields = {
        warranty: { label: 'Warranty', type: 'text', value: '3 years', showInFilter: false },
        certified: { label: 'Certified', type: 'boolean', value: true, showInFilter: true },
      };
      mockPrisma.product.create.mockResolvedValue({
        ...mockCreatedProduct,
        customFields,
      });

      const res = await request(app)
        .post('/api/admin/products')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...validProduct, customFields });

      expect(res.status).toBe(201);
      expect(res.body.customFields).toEqual(customFields);
    });

    it('rejects unknown fields', async () => {
      setAuthToken('ADMIN');
      const res = await request(app)
        .post('/api/admin/products')
        .set('Authorization', 'Bearer valid-token')
        .send({ ...validProduct, unknownField: 'should fail' });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/admin/products/:id', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app)
        .patch('/api/admin/products/prod-1')
        .send({ price: 5999.99 });
      expect(res.status).toBe(401);
    });

    it('returns 403 for MANAGER role', async () => {
      setAuthToken('MANAGER');
      const res = await request(app)
        .patch('/api/admin/products/prod-1')
        .set('Authorization', 'Bearer valid-token')
        .send({ price: 5999.99 });
      expect(res.status).toBe(403);
    });

    it('returns 404 for non-existent product', async () => {
      setAuthToken('ADMIN');
      mockPrisma.product.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .patch('/api/admin/products/non-existent')
        .set('Authorization', 'Bearer valid-token')
        .send({ price: 5999.99 });

      expect(res.status).toBe(404);
    });

    it('updates product with valid partial data', async () => {
      setAuthToken('ADMIN');
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1', name: 'Dell PowerEdge R740' });
      mockPrisma.product.update.mockResolvedValue({
        ...mockCreatedProduct,
        price: 5999.99,
      });

      const res = await request(app)
        .patch('/api/admin/products/prod-1')
        .set('Authorization', 'Bearer valid-token')
        .send({ price: 5999.99 });

      expect(res.status).toBe(200);
      expect(invalidateProductCaches).toHaveBeenCalled();
    });

    it('regenerates slug when name changes', async () => {
      setAuthToken('ADMIN');
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1', name: 'Dell PowerEdge R740' });
      mockPrisma.product.update.mockResolvedValue({
        ...mockCreatedProduct,
        name: 'Dell PowerEdge R750',
        slug: 'dell-poweredge-r750',
      });

      const res = await request(app)
        .patch('/api/admin/products/prod-1')
        .set('Authorization', 'Bearer valid-token')
        .send({ name: 'Dell PowerEdge R750' });

      expect(res.status).toBe(200);
      expect(generateUniqueSlug).toHaveBeenCalledWith('Dell PowerEdge R750', expect.anything());
    });

    it('does not regenerate slug when name is unchanged', async () => {
      setAuthToken('ADMIN');
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1', name: 'Dell PowerEdge R740' });
      mockPrisma.product.update.mockResolvedValue(mockCreatedProduct);

      const res = await request(app)
        .patch('/api/admin/products/prod-1')
        .set('Authorization', 'Bearer valid-token')
        .send({ price: 5999.99 });

      expect(res.status).toBe(200);
      expect(generateUniqueSlug).not.toHaveBeenCalled();
    });

    it('rejects invalid validation (price with 3 decimals)', async () => {
      setAuthToken('ADMIN');
      const res = await request(app)
        .patch('/api/admin/products/prod-1')
        .set('Authorization', 'Bearer valid-token')
        .send({ price: 99.999 });

      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/admin/products/:id', () => {
    it('returns 401 without authentication', async () => {
      const res = await request(app).delete('/api/admin/products/prod-1');
      expect(res.status).toBe(401);
    });

    it('returns 403 for MANAGER role', async () => {
      setAuthToken('MANAGER');
      const res = await request(app)
        .delete('/api/admin/products/prod-1')
        .set('Authorization', 'Bearer valid-token');
      expect(res.status).toBe(403);
    });

    it('returns 404 for non-existent product', async () => {
      setAuthToken('ADMIN');
      mockPrisma.product.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/admin/products/non-existent')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(404);
    });

    it('soft-deletes product (sets isActive = false)', async () => {
      setAuthToken('ADMIN');
      mockPrisma.product.findUnique.mockResolvedValue({ id: 'prod-1' });
      mockPrisma.product.update.mockResolvedValue({ ...mockCreatedProduct, isActive: false });

      const res = await request(app)
        .delete('/api/admin/products/prod-1')
        .set('Authorization', 'Bearer valid-token');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Product deactivated successfully');
      expect(res.body.id).toBe('prod-1');
      expect(mockPrisma.product.update).toHaveBeenCalledWith({
        where: { id: 'prod-1' },
        data: { isActive: false },
      });
      expect(invalidateProductCaches).toHaveBeenCalledWith('prod-1');
    });
  });
});
