import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import * as orderService from '../services/order.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateQuery, validateParams } from '../middleware/validate.js';
import { createOrderSchema } from '../schemas/order.schema.js';
import { sendOrderConfirmation, sendEmailAsync } from '../services/email.service.js';
import { prisma } from '../lib/prisma.js';
import type { OrderEmailData } from '../services/email.service.js';

// ─── Query Schemas ───────────────────────────────────────────────────────────

const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const orderIdParamsSchema = z.object({
  id: z.string().min(1, 'Order ID is required'),
});

// ─── Router ──────────────────────────────────────────────────────────────────

const router = Router();

/**
 * POST /api/orders
 * Create a new order from the user's cart items.
 * Validates product availability, snapshots prices, clears cart on success.
 * Requires authentication.
 */
router.post(
  '/',
  requireAuth,
  validateBody(createOrderSchema),
  async (req: Request, res: Response): Promise<void> => {
    const input: orderService.CreateOrderInput = {
      items: req.body.items,
      contactName: req.body.contactName,
      contactEmail: req.body.email,
      contactPhone: req.body.phone,
      company: req.body.company,
      deliveryAddress: req.body.deliveryAddress,
      comment: req.body.notes,
    };

    const order = await orderService.createOrder(req.user!.userId, input);

    // Fire-and-forget: Send order confirmation email to customer
    const orderEmailData: OrderEmailData = {
      orderNumber: order.orderNumber,
      customerEmail: input.contactEmail,
      customerName: input.contactName,
      items: order.items.map((item) => ({
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
      })),
      totalAmount: Number(order.totalAmount),
      deliveryAddress: input.deliveryAddress,
    };
    sendOrderConfirmation(orderEmailData);

    // Fire-and-forget: Notify all managers about the new order
    prisma.user
      .findMany({
        where: { role: { in: ['MANAGER', 'ADMIN'] }, isActive: true },
        select: { email: true },
      })
      .then((managers) => {
        if (managers.length > 0) {
          const managerEmails = managers.map((m) => m.email);
          const subject = `New Order Received - ${order.orderNumber}`;
          const html = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">New Order Received</h2>
              <p>A new order has been placed:</p>
              <p><strong>Order Number:</strong> ${order.orderNumber}</p>
              <p><strong>Customer:</strong> ${input.contactName} (${input.contactEmail})</p>
              <p><strong>Total:</strong> $${Number(order.totalAmount).toFixed(2)}</p>
              <p><strong>Items:</strong> ${order.items.length}</p>
              <p>Please log in to the admin panel to review this order.</p>
              <p style="color: #666; font-size: 12px;">This is an automated message from KiroPortal.</p>
            </div>
          `;
          sendEmailAsync(managerEmails, subject, html);
        }
      })
      .catch((err: unknown) => {
        console.error('[email] Failed to query managers for order notification:', err);
      });

    res.status(201).json(order);
  },
);

/**
 * GET /api/orders
 * List the authenticated user's orders with cursor-based pagination.
 * Sorted by creation date descending.
 * Requires authentication.
 */
router.get(
  '/',
  requireAuth,
  validateQuery(paginationQuerySchema),
  async (req: Request, res: Response): Promise<void> => {
    const { cursor, limit } = req.query as unknown as z.infer<typeof paginationQuerySchema>;
    const result = await orderService.getUserOrders(req.user!.userId, {
      cursor,
      limit,
    });
    res.status(200).json(result);
  },
);

/**
 * GET /api/orders/:id
 * Get a single order by ID.
 * Verifies ownership — only the order's creator can view it.
 * Requires authentication.
 */
router.get(
  '/:id',
  requireAuth,
  validateParams(orderIdParamsSchema),
  async (req: Request, res: Response): Promise<void> => {
    const order = await orderService.getOrderById(
      req.params.id as string,
      req.user!.userId,
    );
    res.status(200).json(order);
  },
);

export { router as orderRouter };
