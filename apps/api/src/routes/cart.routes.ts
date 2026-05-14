import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import * as cartService from '../services/cart.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';


// ─── Body Schemas ────────────────────────────────────────────────────────────

const addToCartSchema = z.object({
  productId: z.string().min(1, 'Product ID is required'),
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .min(1, 'Quantity must be at least 1')
    .max(99, 'Quantity must be at most 99'),
}).strict();

const updateQuantitySchema = z.object({
  quantity: z
    .number()
    .int('Quantity must be an integer')
    .min(0, 'Quantity must be at least 0')
    .max(99, 'Quantity must be at most 99'),
}).strict();

// ─── Router ──────────────────────────────────────────────────────────────────

const router = Router();

/**
 * GET /api/cart
 * Get the authenticated user's cart with product details.
 * Requires authentication.
 */
router.get(
  '/',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const cart = await cartService.getCart(req.user!.userId);
    res.status(200).json(cart);
  },
);

/**
 * POST /api/cart/items
 * Add a product to the cart.
 * Requires authentication.
 */
router.post(
  '/items',
  requireAuth,
  validateBody(addToCartSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { productId, quantity } = req.body;
    const item = await cartService.addToCart(req.user!.userId, productId, quantity);
    res.status(201).json(item);
  },
);

/**
 * PATCH /api/cart/items/:productId
 * Update the quantity of a cart item.
 * If quantity is 0, the item is removed.
 * Requires authentication.
 */
router.patch(
  '/items/:productId',
  requireAuth,
  validateBody(updateQuantitySchema),
  async (req: Request, res: Response): Promise<void> => {
    const productId = req.params.productId as string;
    const { quantity } = req.body;
    const item = await cartService.updateQuantity(req.user!.userId, productId, quantity);

    if (item === null) {
      res.status(200).json({ message: 'Item removed from cart' });
      return;
    }

    res.status(200).json(item);
  },
);

/**
 * DELETE /api/cart/items/:productId
 * Remove a product from the cart.
 * Requires authentication.
 */
router.delete(
  '/items/:productId',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const productId = req.params.productId as string;
    await cartService.removeFromCart(req.user!.userId, productId);
    res.status(204).send();
  },
);

export { router as cartRouter };
