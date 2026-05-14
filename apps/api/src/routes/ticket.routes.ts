import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import * as ticketService from '../services/ticket.service.js';
import { requireAuth } from '../middleware/auth.js';
import { validateBody, validateQuery, validateParams } from '../middleware/validate.js';
import { createTicketSchema, addMessageSchema } from '../schemas/ticket.schema.js';
import { sendTicketNotification } from '../services/email.service.js';
import { prisma } from '../lib/prisma.js';

// ─── Query Schemas ───────────────────────────────────────────────────────────

const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const ticketIdParamsSchema = z.object({
  id: z.string().min(1, 'Ticket ID is required'),
});

// ─── Router ──────────────────────────────────────────────────────────────────

const router = Router();

/**
 * POST /api/tickets
 * Create a new support ticket.
 * Requires authentication.
 */
router.post(
  '/',
  requireAuth,
  validateBody(createTicketSchema),
  async (req: Request, res: Response): Promise<void> => {
    const ticket = await ticketService.createTicket(req.user!.userId, req.body);
    res.status(201).json(ticket);
  },
);

/**
 * GET /api/tickets
 * List the authenticated user's tickets with cursor-based pagination.
 */
router.get(
  '/',
  requireAuth,
  validateQuery(paginationQuerySchema),
  async (req: Request, res: Response): Promise<void> => {
    const { cursor, limit } = req.query as unknown as z.infer<typeof paginationQuerySchema>;
    const result = await ticketService.getUserTickets(req.user!.userId, {
      cursor,
      limit,
    });
    res.status(200).json(result);
  },
);

/**
 * GET /api/tickets/:id
 * Get a single ticket with messages.
 * Internal messages are filtered out for CLIENT users.
 */
router.get(
  '/:id',
  requireAuth,
  validateParams(ticketIdParamsSchema),
  async (req: Request, res: Response): Promise<void> => {
    const ticket = await ticketService.getTicketById(
      req.params.id as string,
      req.user!.userId,
      req.user!.role as ticketService.UserRole,
    );
    res.status(200).json(ticket);
  },
);

/**
 * POST /api/tickets/:id/messages
 * Add a message to a ticket.
 * Rejects messages on CLOSED tickets.
 * Sends email notifications based on sender role.
 */
router.post(
  '/:id/messages',
  requireAuth,
  validateParams(ticketIdParamsSchema),
  validateBody(addMessageSchema),
  async (req: Request, res: Response): Promise<void> => {
    const message = await ticketService.addMessage(
      req.params.id as string,
      req.user!.userId,
      req.user!.role as ticketService.UserRole,
      req.body,
    );

    // Fire-and-forget: Send email notifications based on sender role
    const userRole = req.user!.role as ticketService.UserRole;
    const isInternal = (userRole === 'MANAGER' || userRole === 'ADMIN') && req.body.isInternal === true;

    // Get ticket details for notification
    prisma.ticket
      .findUnique({
        where: { id: req.params.id as string },
        select: {
          number: true,
          subject: true,
          email: true,
          assignedToId: true,
          assignedTo: { select: { email: true } },
          user: { select: { name: true, email: true } },
        },
      })
      .then((ticket) => {
        if (!ticket) return;

        const notificationData = {
          ticketNumber: ticket.number,
          subject: ticket.subject,
          messageContent: message.content,
          senderName: message.user?.name ?? 'Unknown',
        };

        if (userRole === 'CLIENT') {
          // Customer sent a message: notify assigned manager or all managers
          if (ticket.assignedTo?.email) {
            sendTicketNotification(notificationData, ticket.assignedTo.email);
          } else {
            // No assigned manager — notify all managers
            prisma.user
              .findMany({
                where: { role: { in: ['MANAGER', 'ADMIN'] }, isActive: true },
                select: { email: true },
              })
              .then((managers) => {
                if (managers.length > 0) {
                  sendTicketNotification(
                    notificationData,
                    managers.map((m) => m.email),
                  );
                }
              })
              .catch((err: unknown) => {
                console.error('[email] Failed to query managers for ticket notification:', err);
              });
          }
        } else if ((userRole === 'MANAGER' || userRole === 'ADMIN') && !isInternal) {
          // Manager sent a non-internal message: notify the customer
          sendTicketNotification(notificationData, ticket.email);
        }
      })
      .catch((err: unknown) => {
        console.error('[email] Failed to get ticket for notification:', err);
      });

    res.status(201).json(message);
  },
);

export { router as ticketRouter };
