import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../../lib/prisma.js';
import { requireAuth, requireAdmin, requireManager } from '../../middleware/auth.js';
import { validateBody, validateQuery, validateParams } from '../../middleware/validate.js';
import { createProductSchema, updateProductSchema } from '../../schemas/product.schema.js';
import { generateUniqueSlug } from '../../utils/slug.js';
import { invalidateProductCaches } from '../../services/catalog-cache.service.js';
import { NotFoundError } from '../../utils/errors.js';

// ─── Query / Param Schemas ───────────────────────────────────────────────────

const adminProductQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(200).optional(),
  condition: z.enum(['NEW', 'USED', 'REFURBISHED']).optional(),
  stockStatus: z.enum(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', 'PRE_ORDER']).optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

const productIdParamsSchema = z.object({
  id: z.string().min(1, 'Product ID is required'),
});

// ─── Router ──────────────────────────────────────────────────────────────────

const router = Router();

/**
 * GET /api/admin/products
 * List all products (including inactive) with search, pagination, and filters.
 * Requires MANAGER or ADMIN role.
 */
router.get(
  '/',
  requireAuth,
  requireManager,
  validateQuery(adminProductQuerySchema),
  async (req: Request, res: Response): Promise<void> => {
    const { cursor, limit, search, condition, stockStatus, isActive } =
      req.query as unknown as z.infer<typeof adminProductQuerySchema>;

    // Build where clause
    const where: Record<string, unknown> = {};

    if (condition) {
      where.condition = condition;
    }

    if (stockStatus) {
      where.stockStatus = stockStatus;
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { brand: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Fetch products with cursor-based pagination
    const products = await prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
      include: {
        images: {
          take: 1,
          orderBy: { order: 'asc' },
        },
      },
    });

    // Determine if there's a next page
    const hasNext = products.length > limit;
    const items = hasNext ? products.slice(0, limit) : products;
    const nextCursor = hasNext ? items[items.length - 1]!.id : null;

    // Get total count
    const totalCount = await prisma.product.count({ where });

    res.status(200).json({
      items,
      nextCursor,
      totalCount,
    });
  },
);

/**
 * POST /api/admin/products
 * Create a new product.
 * Requires ADMIN role.
 * Validates with createProductSchema, generates unique slug, invalidates cache.
 */
router.post(
  '/',
  requireAuth,
  requireAdmin,
  validateBody(createProductSchema),
  async (req: Request, res: Response): Promise<void> => {
    const data = req.body;

    // Generate unique slug from product name
    const slug = await generateUniqueSlug(data.name, prisma);

    // Create product in database
    const product = await prisma.product.create({
      data: {
        ...data,
        slug,
        // Ensure customFields is stored as JSON
        customFields: data.customFields ?? {},
      },
      include: {
        images: true,
      },
    });

    // Invalidate product caches
    await invalidateProductCaches(product.id);

    res.status(201).json(product);
  },
);

/**
 * PATCH /api/admin/products/:id
 * Update an existing product.
 * Requires ADMIN role.
 * Validates with updateProductSchema (partial), regenerates slug if name changed.
 */
router.patch(
  '/:id',
  requireAuth,
  requireAdmin,
  validateParams(productIdParamsSchema),
  validateBody(updateProductSchema),
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const data = req.body;

    // Verify product exists
    const existing = await prisma.product.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!existing) {
      throw new NotFoundError('Product not found');
    }

    // If name changed, regenerate slug
    let slug: string | undefined;
    if (data.name && data.name !== existing.name) {
      slug = await generateUniqueSlug(data.name, prisma);
    }

    // Update product in database
    const product = await prisma.product.update({
      where: { id },
      data: {
        ...data,
        ...(slug ? { slug } : {}),
      },
      include: {
        images: true,
      },
    });

    // Invalidate product caches
    await invalidateProductCaches(product.id);

    res.status(200).json(product);
  },
);

/**
 * DELETE /api/admin/products/:id
 * Soft-delete a product (mark as inactive).
 * Preserves order history references by not actually deleting the record.
 * Requires ADMIN role.
 */
router.delete(
  '/:id',
  requireAuth,
  requireAdmin,
  validateParams(productIdParamsSchema),
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;

    // Verify product exists
    const existing = await prisma.product.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundError('Product not found');
    }

    // Soft-delete: set isActive = false
    await prisma.product.update({
      where: { id },
      data: { isActive: false },
    });

    // Invalidate product caches
    await invalidateProductCaches(id);

    res.status(200).json({
      message: 'Product deactivated successfully',
      id,
    });
  },
);

/**
 * DELETE /api/admin/products/:id/images
 * Delete all images for a product.
 * Requires ADMIN role.
 */
router.delete(
  '/:id/images',
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    await prisma.productImage.deleteMany({ where: { productId: id } });
    res.status(200).json({ message: 'Images deleted' });
  },
);

/**
 * POST /api/admin/products/:id/images
 * Add an image to a product.
 * Requires ADMIN role.
 */
router.post(
  '/:id/images',
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const { url, alt, order, isMain } = req.body;

    const product = await prisma.product.findUnique({ where: { id }, select: { id: true } });
    if (!product) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const image = await prisma.productImage.create({
      data: {
        productId: id,
        url,
        alt: alt || null,
        order: order ?? 0,
        isMain: isMain ?? false,
      },
    });

    res.status(201).json(image);
  },
);

export { router as adminProductRouter };
