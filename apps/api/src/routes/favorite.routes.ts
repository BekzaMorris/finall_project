import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import * as favoriteService from '../services/favorite.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validateQuery, validateParams } from '../middleware/validate.js';

// ─── Schemas ─────────────────────────────────────────────────────────────────

const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const productIdParamsSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
});

// ─── Router ──────────────────────────────────────────────────────────────────

const router = Router();

/**
 * GET /api/favorites
 * List the authenticated user's favorites with cursor-based pagination.
 * Excludes products that have been soft-deleted (isActive = false).
 */
router.get(
  '/',
  requireAuth,
  validateQuery(paginationQuerySchema),
  async (req: Request, res: Response): Promise<void> => {
    const { cursor, limit } = req.query as unknown as z.infer<typeof paginationQuerySchema>;
    const result = await favoriteService.getUserFavorites(req.user!.userId, {
      cursor,
      limit,
    });
    res.status(200).json(result);
  },
);

/**
 * POST /api/favorites/:productId
 * Add a product to the authenticated user's favorites.
 * Idempotent: returns 201 even if already favorited (no duplicate created).
 * Returns 404 if the product does not exist or is inactive.
 */
router.post(
  '/:productId',
  requireAuth,
  validateParams(productIdParamsSchema),
  async (req: Request, res: Response): Promise<void> => {
    await favoriteService.addFavorite(req.user!.userId, req.params.productId as string);
    res.status(201).json({ message: 'Added to favorites' });
  },
);

/**
 * DELETE /api/favorites/:productId
 * Remove a product from the authenticated user's favorites.
 * Idempotent: returns 200 even if the product was not in favorites.
 */
router.delete(
  '/:productId',
  requireAuth,
  validateParams(productIdParamsSchema),
  async (req: Request, res: Response): Promise<void> => {
    await favoriteService.removeFavorite(req.user!.userId, req.params.productId as string);
    res.status(200).json({ message: 'Removed from favorites' });
  },
);

export { router as favoriteRouter };
