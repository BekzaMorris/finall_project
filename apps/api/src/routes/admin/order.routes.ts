import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import * as orderService from '../../services/order.service.js';
import { requireAuth, requireManager } from '../../middleware/auth.js';
import { validateBody, validateQuery, validateParams } from '../../middleware/validate.js';
import { updateOrderStatusSchema } from '../../schemas/order.schema.js';
import { sendOrderStatusChange } from '../../services/email.service.js';
import type { OrderStatus } from '../../generated/prisma/enums.js';

// ─── Query Schemas ───────────────────────────────────────────────────────────

const adminOrderQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED']).optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
  customerEmail: z.string().optional(),
});

const orderIdParamsSchema = z.object({
  id: z.string().min(1, 'Order ID is required'),
});

// ─── Router ──────────────────────────────────────────────────────────────────

const router = Router();

/**
 * GET /api/admin/orders
 * List all orders with filters and cursor-based pagination.
 * Supports filtering by status, date range, and customer email.
 * Requires MANAGER or ADMIN role.
 */
router.get(
  '/',
  requireAuth,
  requireManager,
  validateQuery(adminOrderQuerySchema),
  async (req: Request, res: Response): Promise<void> => {
    const { cursor, limit, status, dateFrom, dateTo, customerEmail } =
      req.query as unknown as z.infer<typeof adminOrderQuerySchema>;

    const result = await orderService.getAdminOrders(
      {
        status,
        dateFrom,
        dateTo,
        customerEmail,
      },
      { cursor, limit },
    );
    res.status(200).json(result);
  },
);

/**
 * PATCH /api/admin/orders/:id/status
 * Update an order's status following the defined workflow transitions.
 * Records the transition in status history with manager ID and optional note.
 * Requires MANAGER or ADMIN role.
 */
router.patch(
  '/:id/status',
  requireAuth,
  requireManager,
  validateParams(orderIdParamsSchema),
  validateBody(updateOrderStatusSchema),
  async (req: Request, res: Response): Promise<void> => {
    // Get the current order to capture previous status
    const currentOrder = await orderService.getOrderById(req.params.id as string);
    const previousStatus = currentOrder.status;

    const order = await orderService.updateOrderStatus(
      req.params.id as string,
      req.body.status as OrderStatus,
      req.user!.userId,
      req.body.note,
    );

    // Fire-and-forget: Send status change notification to customer
    sendOrderStatusChange({
      orderNumber: order.orderNumber,
      customerEmail: order.email,
      customerName: order.contactName,
      previousStatus,
      newStatus: order.status,
      note: req.body.note,
    });

    res.status(200).json(order);
  },
);

export { router as adminOrderRouter };
