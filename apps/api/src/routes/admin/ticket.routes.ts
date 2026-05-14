import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import * as ticketService from '../../services/ticket.service.js';
import { requireAuth, requireManager } from '../../middleware/auth.js';
import { validateBody, validateQuery, validateParams } from '../../middleware/validate.js';
import { updateTicketStatusSchema, assignTicketSchema } from '../../schemas/ticket.schema.js';
import { sendTicketNotification } from '../../services/email.service.js';

// ─── Query Schemas ───────────────────────────────────────────────────────────

const adminTicketQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assignedToId: z.string().optional(),
  dateFrom: z.coerce.date().optional(),
  dateTo: z.coerce.date().optional(),
});

const ticketIdParamsSchema = z.object({
  id: z.string().min(1, 'Ticket ID is required'),
});

// ─── Router ──────────────────────────────────────────────────────────────────

const router = Router();

/**
 * GET /api/admin/tickets
 * List all tickets with filters and cursor-based pagination.
 * Requires MANAGER or ADMIN role.
 */
router.get(
  '/',
  requireAuth,
  requireManager,
  validateQuery(adminTicketQuerySchema),
  async (req: Request, res: Response): Promise<void> => {
    const { cursor, limit, status, priority, assignedToId, dateFrom, dateTo } =
      req.query as unknown as z.infer<typeof adminTicketQuerySchema>;

    const result = await ticketService.getAdminTickets(
      {
        status: status as ticketService.TicketStatus | undefined,
        priority: priority as ticketService.TicketPriority | undefined,
        assignedToId,
        dateFrom,
        dateTo,
      },
      { cursor, limit },
    );
    res.status(200).json(result);
  },
);

/**
 * PATCH /api/admin/tickets/:id/status
 * Update a ticket's status.
 * Sends notification to the ticket's customer.
 * Requires MANAGER or ADMIN role.
 */
router.patch(
  '/:id/status',
  requireAuth,
  requireManager,
  validateParams(ticketIdParamsSchema),
  validateBody(updateTicketStatusSchema),
  async (req: Request, res: Response): Promise<void> => {
    const ticket = await ticketService.updateStatus(
      req.params.id as string,
      req.body.status,
      req.user!.userId,
    );

    // Fire-and-forget: Notify the customer about the status change
    if (ticket.user?.email) {
      sendTicketNotification(
        {
          ticketNumber: ticket.number,
          subject: ticket.subject,
          messageContent: `Ticket status changed to: ${req.body.status}`,
          senderName: 'Support Team',
        },
        ticket.user.email,
      );
    }

    res.status(200).json(ticket);
  },
);

/**
 * PATCH /api/admin/tickets/:id/assign
 * Assign a ticket to a manager.
 * Requires MANAGER or ADMIN role.
 */
router.patch(
  '/:id/assign',
  requireAuth,
  requireManager,
  validateParams(ticketIdParamsSchema),
  validateBody(assignTicketSchema),
  async (req: Request, res: Response): Promise<void> => {
    const ticket = await ticketService.assignTicket(
      req.params.id as string,
      req.body.managerId,
    );
    res.status(200).json(ticket);
  },
);

export { router as adminTicketRouter };
