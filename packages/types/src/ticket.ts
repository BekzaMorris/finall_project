import { TicketPriority, TicketStatus } from './enums';

// ─── Ticket Types ────────────────────────────────────────────────────────────

export interface TicketMessage {
  id: string;
  ticketId: string;
  userId: string;
  content: string;
  attachments: string[]; // S3 URLs
  isInternal: boolean; // Manager-only notes
  createdAt: Date;
}

export interface Ticket {
  id: string;
  ticketNumber: string; // Sequential: TKT-000001
  userId: string;
  subject: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignedManagerId?: string;
  orderId?: string; // Optional link to order
  messages: TicketMessage[];
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

export interface CreateTicketInput {
  subject: string;
  message: string;
  priority: TicketPriority;
  orderId?: string;
  attachments?: string[];
}
