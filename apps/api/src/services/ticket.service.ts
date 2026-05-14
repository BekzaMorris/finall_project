import { prisma } from '../lib/prisma.js';
import { ValidationError, NotFoundError, ForbiddenError } from '../utils/errors.js';
import { sanitizeHtml } from '../utils/sanitize.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'WAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED';
export type UserRole = 'CLIENT' | 'MANAGER' | 'ADMIN';

export interface CreateTicketInput {
  subject: string;
  message: string;
  priority?: TicketPriority;
  orderId?: string;
  attachments?: string[];
}

export interface AddMessageInput {
  content: string;
  isInternal?: boolean;
  attachments?: string[];
}

export interface TicketFilters {
  status?: TicketStatus;
  priority?: TicketPriority;
  assignedToId?: string | null;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface CursorPagination {
  cursor?: string;
  limit: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const SUBJECT_MIN_LENGTH = 5;
const SUBJECT_MAX_LENGTH = 200;
const MESSAGE_MIN_LENGTH = 1;
const MESSAGE_MAX_LENGTH = 5000;

/**
 * Valid ticket status transitions.
 * CLOSED is a terminal state with no outgoing transitions.
 */
export const VALID_STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'],
  WAITING_CUSTOMER: ['IN_PROGRESS', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED', 'OPEN'],
  CLOSED: [],
};

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Sanitize HTML content using DOMPurify to prevent XSS attacks.
 */
function sanitizeContent(content: string): string {
  return sanitizeHtml(content);
}

/**
 * Validate ticket subject: 5-200 chars after trimming, no whitespace-only.
 */
function validateSubject(subject: string): string {
  const trimmed = subject.trim();
  if (trimmed.length < SUBJECT_MIN_LENGTH) {
    throw new ValidationError(
      `Subject must be at least ${SUBJECT_MIN_LENGTH} characters`,
      { subject: `Minimum ${SUBJECT_MIN_LENGTH} characters required` },
    );
  }
  if (trimmed.length > SUBJECT_MAX_LENGTH) {
    throw new ValidationError(
      `Subject must be at most ${SUBJECT_MAX_LENGTH} characters`,
      { subject: `Maximum ${SUBJECT_MAX_LENGTH} characters allowed` },
    );
  }
  return trimmed;
}

/**
 * Validate message content: 1-5000 chars after trimming, no whitespace-only.
 */
function validateMessageContent(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length < MESSAGE_MIN_LENGTH) {
    throw new ValidationError(
      `Message content must be at least ${MESSAGE_MIN_LENGTH} character`,
      { content: `Minimum ${MESSAGE_MIN_LENGTH} character required` },
    );
  }
  if (trimmed.length > MESSAGE_MAX_LENGTH) {
    throw new ValidationError(
      `Message content must be at most ${MESSAGE_MAX_LENGTH} characters`,
      { content: `Maximum ${MESSAGE_MAX_LENGTH} characters allowed` },
    );
  }
  return trimmed;
}

/**
 * Generate the next sequential ticket number in TKT-NNNNNN format.
 */
async function generateTicketNumber(): Promise<string> {
  // Find the highest existing ticket number
  const lastTicket = await prisma.ticket.findFirst({
    orderBy: { number: 'desc' },
    select: { number: true },
  });

  let nextNum = 1;
  if (lastTicket) {
    const match = lastTicket.number.match(/^TKT-(\d+)$/);
    if (match) {
      nextNum = parseInt(match[1]!, 10) + 1;
    }
  }

  return `TKT-${String(nextNum).padStart(6, '0')}`;
}

/**
 * Check if a status transition is valid.
 */
export function isValidTransition(from: TicketStatus, to: TicketStatus): boolean {
  return VALID_STATUS_TRANSITIONS[from].includes(to);
}

// ─── Ticket Service ──────────────────────────────────────────────────────────

/**
 * Create a new support ticket with an initial message.
 * Assigns a sequential ticket number (TKT-NNNNNN) and sets status to OPEN.
 */
export async function createTicket(userId: string, input: CreateTicketInput) {
  // Validate subject and message
  const subject = validateSubject(input.subject);
  const messageContent = validateMessageContent(input.message);

  // Sanitize content
  const sanitizedMessage = sanitizeContent(messageContent);

  // Get user email for the ticket
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Generate sequential ticket number
  const ticketNumber = await generateTicketNumber();

  // Create ticket with initial message in a transaction
  const ticket = await prisma.ticket.create({
    data: {
      number: ticketNumber,
      userId,
      email: user.email,
      subject,
      priority: input.priority ?? 'MEDIUM',
      status: 'OPEN',
      messages: {
        create: {
          userId,
          content: sanitizedMessage,
          attachments: JSON.stringify(input.attachments ?? []),
          isInternal: false,
        },
      },
    },
    include: {
      messages: {
        include: { user: { select: { id: true, name: true, role: true } } },
      },
    },
  });

  return ticket;
}

/**
 * Get a ticket by ID with messages.
 * If the user is a CLIENT, internal messages are filtered out.
 * MANAGER/ADMIN can see all messages including internal ones.
 */
export async function getTicketById(ticketId: string, userId: string, userRole: UserRole) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      messages: {
        include: { user: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'asc' },
      },
      user: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });

  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  // Clients can only see their own tickets
  if (userRole === 'CLIENT' && ticket.userId !== userId) {
    throw new NotFoundError('Ticket not found');
  }

  // Filter out internal messages for CLIENT users
  if (userRole === 'CLIENT') {
    return {
      ...ticket,
      messages: ticket.messages.filter((msg) => !msg.isInternal),
    };
  }

  return ticket;
}

/**
 * Get a user's tickets with cursor-based pagination.
 */
export async function getUserTickets(userId: string, pagination: CursorPagination) {
  const { cursor, limit } = pagination;

  const tickets = await prisma.ticket.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
    include: {
      assignedTo: { select: { id: true, name: true } },
      _count: { select: { messages: true } },
    },
  });

  const hasNext = tickets.length > limit;
  const items = hasNext ? tickets.slice(0, limit) : tickets;

  return {
    items,
    nextCursor: hasNext ? items[items.length - 1]!.id : null,
    totalCount: await prisma.ticket.count({ where: { userId } }),
  };
}

/**
 * Add a message to a ticket.
 * Rejects messages on CLOSED tickets.
 * Only MANAGER/ADMIN can set isInternal flag.
 */
export async function addMessage(
  ticketId: string,
  userId: string,
  userRole: UserRole,
  input: AddMessageInput,
) {
  // Validate message content
  const content = validateMessageContent(input.content);
  const sanitizedContent = sanitizeContent(content);

  // Get the ticket to check status
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, status: true, userId: true },
  });

  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  // Reject messages on CLOSED tickets
  if (ticket.status === 'CLOSED') {
    throw new ValidationError('Cannot add messages to a closed ticket');
  }

  // Clients can only add messages to their own tickets
  if (userRole === 'CLIENT' && ticket.userId !== userId) {
    throw new ForbiddenError('You do not have access to this ticket');
  }

  // Only MANAGER/ADMIN can set isInternal
  const isInternal = (userRole === 'MANAGER' || userRole === 'ADMIN') && input.isInternal === true;

  const message = await prisma.ticketMessage.create({
    data: {
      ticketId,
      userId,
      content: sanitizedContent,
      attachments: JSON.stringify(input.attachments ?? []),
      isInternal,
    },
    include: {
      user: { select: { id: true, name: true, role: true } },
    },
  });

  // Update ticket's updatedAt timestamp
  await prisma.ticket.update({
    where: { id: ticketId },
    data: { updatedAt: new Date() },
  });

  return message;
}

/**
 * Update ticket status with transition validation.
 * CLOSED is a terminal state - no transitions out.
 * Throws ValidationError for invalid transitions.
 */
export async function updateStatus(ticketId: string, newStatus: TicketStatus, userId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true, status: true },
  });

  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  const currentStatus = ticket.status as TicketStatus;

  // Validate transition
  if (!isValidTransition(currentStatus, newStatus)) {
    const allowed = VALID_STATUS_TRANSITIONS[currentStatus];
    throw new ValidationError(
      `Invalid status transition from ${currentStatus} to ${newStatus}. Allowed transitions: ${allowed.length > 0 ? allowed.join(', ') : 'none (terminal state)'}`,
      { status: `Cannot transition from ${currentStatus} to ${newStatus}` },
    );
  }

  // Update status
  const updatedTicket = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      status: newStatus,
      ...(newStatus === 'RESOLVED' && { resolvedAt: new Date() }),
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });

  return updatedTicket;
}

/**
 * Assign a ticket to a manager.
 */
export async function assignTicket(ticketId: string, managerId: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: { id: true },
  });

  if (!ticket) {
    throw new NotFoundError('Ticket not found');
  }

  // Verify the assignee exists and has MANAGER or ADMIN role
  const manager = await prisma.user.findUnique({
    where: { id: managerId },
    select: { id: true, role: true },
  });

  if (!manager) {
    throw new NotFoundError('Manager not found');
  }

  if (manager.role !== 'MANAGER' && manager.role !== 'ADMIN') {
    throw new ValidationError('Ticket can only be assigned to a user with MANAGER or ADMIN role');
  }

  const updatedTicket = await prisma.ticket.update({
    where: { id: ticketId },
    data: { assignedToId: managerId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
  });

  return updatedTicket;
}

/**
 * Get admin ticket list with filters and cursor-based pagination.
 */
export async function getAdminTickets(filters: TicketFilters, pagination: CursorPagination) {
  const { cursor, limit } = pagination;

  // Build where clause from filters
  const where: Record<string, unknown> = {};

  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.priority) {
    where.priority = filters.priority;
  }
  if (filters.assignedToId !== undefined) {
    where.assignedToId = filters.assignedToId;
  }
  if (filters.dateFrom || filters.dateTo) {
    where.createdAt = {
      ...(filters.dateFrom && { gte: filters.dateFrom }),
      ...(filters.dateTo && { lte: filters.dateTo }),
    };
  }

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
    include: {
      user: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true } },
      _count: { select: { messages: true } },
    },
  });

  const hasNext = tickets.length > limit;
  const items = hasNext ? tickets.slice(0, limit) : tickets;

  return {
    items,
    nextCursor: hasNext ? items[items.length - 1]!.id : null,
    totalCount: await prisma.ticket.count({ where }),
  };
}
