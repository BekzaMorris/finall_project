import { z } from 'zod';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Validates that a string is not whitespace-only after trimming.
 */
function isNotWhitespaceOnly(val: string): boolean {
  return val.trim().length > 0;
}

// ─── Enums ───────────────────────────────────────────────────────────────────

const ticketPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
const ticketStatusEnum = z.enum([
  'OPEN',
  'IN_PROGRESS',
  'WAITING_CUSTOMER',
  'RESOLVED',
  'CLOSED',
]);

// ─── Create Ticket Schema ────────────────────────────────────────────────────

export const createTicketSchema = z.object({
  subject: z
    .string()
    .transform((val) => val.trim())
    .pipe(
      z
        .string()
        .min(5, 'Subject must be at least 5 characters')
        .max(200, 'Subject must be at most 200 characters')
        .refine(isNotWhitespaceOnly, 'Subject cannot be whitespace only'),
    ),
  message: z
    .string()
    .transform((val) => val.trim())
    .pipe(
      z
        .string()
        .min(1, 'Message is required')
        .max(5000, 'Message must be at most 5000 characters')
        .refine(isNotWhitespaceOnly, 'Message cannot be whitespace only'),
    ),
  priority: ticketPriorityEnum.optional().default('MEDIUM'),
  orderId: z.string().optional(),
}).strict();

// ─── Add Message Schema ──────────────────────────────────────────────────────

export const addMessageSchema = z.object({
  content: z
    .string()
    .transform((val) => val.trim())
    .pipe(
      z
        .string()
        .min(1, 'Message content is required')
        .max(5000, 'Message must be at most 5000 characters')
        .refine(isNotWhitespaceOnly, 'Message cannot be whitespace only'),
    ),
  isInternal: z.boolean().optional().default(false),
  attachments: z.array(z.string().url('Invalid attachment URL')).max(5, 'Maximum 5 attachments allowed').optional(),
}).strict();

// ─── Update Ticket Status Schema ─────────────────────────────────────────────

export const updateTicketStatusSchema = z.object({
  status: ticketStatusEnum,
}).strict();

// ─── Assign Ticket Schema ────────────────────────────────────────────────────

export const assignTicketSchema = z.object({
  managerId: z.string().min(1, 'Manager ID is required'),
}).strict();

// ─── Exports ─────────────────────────────────────────────────────────────────

export { ticketPriorityEnum, ticketStatusEnum, isNotWhitespaceOnly };
