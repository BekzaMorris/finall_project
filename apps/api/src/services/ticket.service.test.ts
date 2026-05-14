import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    ticket: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    ticketMessage: {
      create: vi.fn(),
    },
  },
}));

// Mock isomorphic-dompurify (used by ../utils/sanitize.js)
vi.mock('isomorphic-dompurify', () => ({
  default: {
    sanitize: vi.fn((input: string) => input.replace(/<script[^>]*>.*?<\/script>/gi, '')),
  },
}));

import { prisma } from '../lib/prisma.js';
import {
  createTicket,
  getTicketById,
  getUserTickets,
  addMessage,
  updateStatus,
  assignTicket,
  getAdminTickets,
  isValidTransition,
  VALID_STATUS_TRANSITIONS,
} from './ticket.service.js';
import type { TicketStatus } from './ticket.service.js';

const mockPrisma = prisma as unknown as {
  user: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  ticket: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  ticketMessage: {
    create: ReturnType<typeof vi.fn>;
  };
};

// ─── Test Data ───────────────────────────────────────────────────────────────

const TEST_USER = {
  id: 'user-123',
  email: 'client@example.com',
  name: 'Test Client',
  role: 'CLIENT',
};

const TEST_MANAGER = {
  id: 'manager-456',
  email: 'manager@example.com',
  name: 'Test Manager',
  role: 'MANAGER',
};

const TEST_ADMIN = {
  id: 'admin-789',
  email: 'admin@example.com',
  name: 'Test Admin',
  role: 'ADMIN',
};

const TEST_TICKET = {
  id: 'ticket-001',
  number: 'TKT-000001',
  userId: TEST_USER.id,
  email: TEST_USER.email,
  subject: 'Test ticket subject',
  priority: 'MEDIUM',
  status: 'OPEN',
  assignedToId: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  resolvedAt: null,
};

describe('Ticket Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Status Transitions ──────────────────────────────────────────────────

  describe('isValidTransition', () => {
    it('allows OPEN → IN_PROGRESS', () => {
      expect(isValidTransition('OPEN', 'IN_PROGRESS')).toBe(true);
    });

    it('allows OPEN → RESOLVED', () => {
      expect(isValidTransition('OPEN', 'RESOLVED')).toBe(true);
    });

    it('allows OPEN → CLOSED', () => {
      expect(isValidTransition('OPEN', 'CLOSED')).toBe(true);
    });

    it('allows IN_PROGRESS → WAITING_CUSTOMER', () => {
      expect(isValidTransition('IN_PROGRESS', 'WAITING_CUSTOMER')).toBe(true);
    });

    it('allows IN_PROGRESS → RESOLVED', () => {
      expect(isValidTransition('IN_PROGRESS', 'RESOLVED')).toBe(true);
    });

    it('allows IN_PROGRESS → CLOSED', () => {
      expect(isValidTransition('IN_PROGRESS', 'CLOSED')).toBe(true);
    });

    it('allows WAITING_CUSTOMER → IN_PROGRESS', () => {
      expect(isValidTransition('WAITING_CUSTOMER', 'IN_PROGRESS')).toBe(true);
    });

    it('allows WAITING_CUSTOMER → RESOLVED', () => {
      expect(isValidTransition('WAITING_CUSTOMER', 'RESOLVED')).toBe(true);
    });

    it('allows WAITING_CUSTOMER → CLOSED', () => {
      expect(isValidTransition('WAITING_CUSTOMER', 'CLOSED')).toBe(true);
    });

    it('allows RESOLVED → CLOSED', () => {
      expect(isValidTransition('RESOLVED', 'CLOSED')).toBe(true);
    });

    it('allows RESOLVED → OPEN (reopen)', () => {
      expect(isValidTransition('RESOLVED', 'OPEN')).toBe(true);
    });

    it('rejects CLOSED → any (terminal state)', () => {
      const allStatuses: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'];
      for (const status of allStatuses) {
        expect(isValidTransition('CLOSED', status)).toBe(false);
      }
    });

    it('rejects OPEN → WAITING_CUSTOMER (invalid)', () => {
      expect(isValidTransition('OPEN', 'WAITING_CUSTOMER')).toBe(false);
    });

    it('rejects OPEN → OPEN (same state)', () => {
      expect(isValidTransition('OPEN', 'OPEN')).toBe(false);
    });

    it('rejects IN_PROGRESS → OPEN (invalid)', () => {
      expect(isValidTransition('IN_PROGRESS', 'OPEN')).toBe(false);
    });

    it('rejects RESOLVED → IN_PROGRESS (invalid)', () => {
      expect(isValidTransition('RESOLVED', 'IN_PROGRESS')).toBe(false);
    });
  });

  // ─── updateStatus ────────────────────────────────────────────────────────

  describe('updateStatus', () => {
    it('updates status for valid transition', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({ ...TEST_TICKET, status: 'OPEN' });
      mockPrisma.ticket.update.mockResolvedValue({
        ...TEST_TICKET,
        status: 'IN_PROGRESS',
        user: TEST_USER,
        assignedTo: null,
      });

      const result = await updateStatus('ticket-001', 'IN_PROGRESS', TEST_MANAGER.id);

      expect(result.status).toBe('IN_PROGRESS');
      expect(mockPrisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ticket-001' },
          data: expect.objectContaining({ status: 'IN_PROGRESS' }),
        }),
      );
    });

    it('sets resolvedAt when transitioning to RESOLVED', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({ ...TEST_TICKET, status: 'IN_PROGRESS' });
      mockPrisma.ticket.update.mockResolvedValue({
        ...TEST_TICKET,
        status: 'RESOLVED',
        resolvedAt: new Date(),
        user: TEST_USER,
        assignedTo: null,
      });

      await updateStatus('ticket-001', 'RESOLVED', TEST_MANAGER.id);

      expect(mockPrisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'RESOLVED',
            resolvedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('throws ValidationError for invalid transition', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({ ...TEST_TICKET, status: 'OPEN' });

      await expect(
        updateStatus('ticket-001', 'WAITING_CUSTOMER', TEST_MANAGER.id),
      ).rejects.toThrow('Invalid status transition from OPEN to WAITING_CUSTOMER');
    });

    it('throws ValidationError when transitioning from CLOSED (terminal)', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({ ...TEST_TICKET, status: 'CLOSED' });

      await expect(
        updateStatus('ticket-001', 'OPEN', TEST_MANAGER.id),
      ).rejects.toThrow('Invalid status transition from CLOSED to OPEN');
    });

    it('throws NotFoundError for non-existent ticket', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(null);

      await expect(
        updateStatus('non-existent', 'IN_PROGRESS', TEST_MANAGER.id),
      ).rejects.toThrow('Ticket not found');
    });
  });

  // ─── addMessage ──────────────────────────────────────────────────────────

  describe('addMessage', () => {
    it('adds a message to an OPEN ticket', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({
        id: TEST_TICKET.id,
        status: 'OPEN',
        userId: TEST_USER.id,
      });
      mockPrisma.ticketMessage.create.mockResolvedValue({
        id: 'msg-001',
        ticketId: TEST_TICKET.id,
        userId: TEST_USER.id,
        content: 'Hello, I need help',
        attachments: '[]',
        isInternal: false,
        createdAt: new Date(),
        user: { id: TEST_USER.id, name: TEST_USER.name, role: TEST_USER.role },
      });
      mockPrisma.ticket.update.mockResolvedValue({});

      const result = await addMessage(TEST_TICKET.id, TEST_USER.id, 'CLIENT', {
        content: 'Hello, I need help',
      });

      expect(result.content).toBe('Hello, I need help');
      expect(result.isInternal).toBe(false);
    });

    it('rejects messages on CLOSED tickets', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({
        id: TEST_TICKET.id,
        status: 'CLOSED',
        userId: TEST_USER.id,
      });

      await expect(
        addMessage(TEST_TICKET.id, TEST_USER.id, 'CLIENT', {
          content: 'This should fail',
        }),
      ).rejects.toThrow('Cannot add messages to a closed ticket');
    });

    it('allows MANAGER to set isInternal flag', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({
        id: TEST_TICKET.id,
        status: 'OPEN',
        userId: TEST_USER.id,
      });
      mockPrisma.ticketMessage.create.mockResolvedValue({
        id: 'msg-002',
        ticketId: TEST_TICKET.id,
        userId: TEST_MANAGER.id,
        content: 'Internal note',
        attachments: '[]',
        isInternal: true,
        createdAt: new Date(),
        user: { id: TEST_MANAGER.id, name: TEST_MANAGER.name, role: TEST_MANAGER.role },
      });
      mockPrisma.ticket.update.mockResolvedValue({});

      const result = await addMessage(TEST_TICKET.id, TEST_MANAGER.id, 'MANAGER', {
        content: 'Internal note',
        isInternal: true,
      });

      expect(result.isInternal).toBe(true);
      expect(mockPrisma.ticketMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isInternal: true }),
        }),
      );
    });

    it('allows ADMIN to set isInternal flag', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({
        id: TEST_TICKET.id,
        status: 'IN_PROGRESS',
        userId: TEST_USER.id,
      });
      mockPrisma.ticketMessage.create.mockResolvedValue({
        id: 'msg-003',
        ticketId: TEST_TICKET.id,
        userId: TEST_ADMIN.id,
        content: 'Admin internal note',
        attachments: '[]',
        isInternal: true,
        createdAt: new Date(),
        user: { id: TEST_ADMIN.id, name: TEST_ADMIN.name, role: TEST_ADMIN.role },
      });
      mockPrisma.ticket.update.mockResolvedValue({});

      const result = await addMessage(TEST_TICKET.id, TEST_ADMIN.id, 'ADMIN', {
        content: 'Admin internal note',
        isInternal: true,
      });

      expect(result.isInternal).toBe(true);
    });

    it('ignores isInternal flag for CLIENT users', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({
        id: TEST_TICKET.id,
        status: 'OPEN',
        userId: TEST_USER.id,
      });
      mockPrisma.ticketMessage.create.mockResolvedValue({
        id: 'msg-004',
        ticketId: TEST_TICKET.id,
        userId: TEST_USER.id,
        content: 'Client message',
        attachments: '[]',
        isInternal: false,
        createdAt: new Date(),
        user: { id: TEST_USER.id, name: TEST_USER.name, role: TEST_USER.role },
      });
      mockPrisma.ticket.update.mockResolvedValue({});

      await addMessage(TEST_TICKET.id, TEST_USER.id, 'CLIENT', {
        content: 'Client message',
        isInternal: true, // Should be ignored
      });

      expect(mockPrisma.ticketMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isInternal: false }),
        }),
      );
    });

    it('rejects empty message content', async () => {
      await expect(
        addMessage(TEST_TICKET.id, TEST_USER.id, 'CLIENT', {
          content: '   ',
        }),
      ).rejects.toThrow('Message content must be at least 1 character');
    });

    it('rejects message content exceeding 5000 chars', async () => {
      const longContent = 'a'.repeat(5001);

      await expect(
        addMessage(TEST_TICKET.id, TEST_USER.id, 'CLIENT', {
          content: longContent,
        }),
      ).rejects.toThrow('Message content must be at most 5000 characters');
    });

    it('throws NotFoundError for non-existent ticket', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(null);

      await expect(
        addMessage('non-existent', TEST_USER.id, 'CLIENT', {
          content: 'Hello',
        }),
      ).rejects.toThrow('Ticket not found');
    });

    it('adds message to IN_PROGRESS ticket', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({
        id: TEST_TICKET.id,
        status: 'IN_PROGRESS',
        userId: TEST_USER.id,
      });
      mockPrisma.ticketMessage.create.mockResolvedValue({
        id: 'msg-005',
        ticketId: TEST_TICKET.id,
        userId: TEST_USER.id,
        content: 'Follow up',
        attachments: '[]',
        isInternal: false,
        createdAt: new Date(),
        user: { id: TEST_USER.id, name: TEST_USER.name, role: TEST_USER.role },
      });
      mockPrisma.ticket.update.mockResolvedValue({});

      const result = await addMessage(TEST_TICKET.id, TEST_USER.id, 'CLIENT', {
        content: 'Follow up',
      });

      expect(result.content).toBe('Follow up');
    });
  });

  // ─── Internal Message Visibility ─────────────────────────────────────────

  describe('getTicketById - internal message visibility', () => {
    const ticketWithMessages = {
      ...TEST_TICKET,
      user: { id: TEST_USER.id, name: TEST_USER.name, email: TEST_USER.email },
      assignedTo: null,
      messages: [
        {
          id: 'msg-1',
          ticketId: TEST_TICKET.id,
          userId: TEST_USER.id,
          content: 'Public message from client',
          attachments: '[]',
          isInternal: false,
          createdAt: new Date('2024-01-01T10:00:00'),
          user: { id: TEST_USER.id, name: TEST_USER.name, role: 'CLIENT' },
        },
        {
          id: 'msg-2',
          ticketId: TEST_TICKET.id,
          userId: TEST_MANAGER.id,
          content: 'Internal note from manager',
          attachments: '[]',
          isInternal: true,
          createdAt: new Date('2024-01-01T11:00:00'),
          user: { id: TEST_MANAGER.id, name: TEST_MANAGER.name, role: 'MANAGER' },
        },
        {
          id: 'msg-3',
          ticketId: TEST_TICKET.id,
          userId: TEST_MANAGER.id,
          content: 'Public reply from manager',
          attachments: '[]',
          isInternal: false,
          createdAt: new Date('2024-01-01T12:00:00'),
          user: { id: TEST_MANAGER.id, name: TEST_MANAGER.name, role: 'MANAGER' },
        },
      ],
    };

    it('filters out internal messages for CLIENT users', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(ticketWithMessages);

      const result = await getTicketById(TEST_TICKET.id, TEST_USER.id, 'CLIENT');

      expect(result.messages).toHaveLength(2);
      expect(result.messages.every((m: { isInternal: boolean }) => !m.isInternal)).toBe(true);
      expect(result.messages.map((m: { id: string }) => m.id)).toEqual(['msg-1', 'msg-3']);
    });

    it('shows all messages including internal for MANAGER users', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(ticketWithMessages);

      const result = await getTicketById(TEST_TICKET.id, TEST_MANAGER.id, 'MANAGER');

      expect(result.messages).toHaveLength(3);
      expect(result.messages.map((m: { id: string }) => m.id)).toEqual(['msg-1', 'msg-2', 'msg-3']);
    });

    it('shows all messages including internal for ADMIN users', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(ticketWithMessages);

      const result = await getTicketById(TEST_TICKET.id, TEST_ADMIN.id, 'ADMIN');

      expect(result.messages).toHaveLength(3);
    });

    it('throws NotFoundError when CLIENT tries to access another user ticket', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({
        ...ticketWithMessages,
        userId: 'other-user-id',
      });

      await expect(
        getTicketById(TEST_TICKET.id, TEST_USER.id, 'CLIENT'),
      ).rejects.toThrow('Ticket not found');
    });
  });

  // ─── createTicket ────────────────────────────────────────────────────────

  describe('createTicket', () => {
    it('creates a ticket with sequential number and OPEN status', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);
      mockPrisma.ticket.findFirst.mockResolvedValue(null); // No existing tickets
      mockPrisma.ticket.create.mockResolvedValue({
        ...TEST_TICKET,
        number: 'TKT-000001',
        status: 'OPEN',
        messages: [
          {
            id: 'msg-init',
            ticketId: TEST_TICKET.id,
            userId: TEST_USER.id,
            content: 'I need help with my order',
            attachments: '[]',
            isInternal: false,
            createdAt: new Date(),
            user: { id: TEST_USER.id, name: TEST_USER.name, role: TEST_USER.role },
          },
        ],
      });

      const result = await createTicket(TEST_USER.id, {
        subject: 'Help with order',
        message: 'I need help with my order',
        priority: 'HIGH',
      });

      expect(result.number).toBe('TKT-000001');
      expect(result.status).toBe('OPEN');
      expect(result.messages).toHaveLength(1);
      expect(mockPrisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'OPEN',
            priority: 'HIGH',
            number: 'TKT-000001',
          }),
        }),
      );
    });

    it('increments ticket number from last existing ticket', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);
      mockPrisma.ticket.findFirst.mockResolvedValue({ number: 'TKT-000042' });
      mockPrisma.ticket.create.mockResolvedValue({
        ...TEST_TICKET,
        number: 'TKT-000043',
        messages: [],
      });

      await createTicket(TEST_USER.id, {
        subject: 'Another ticket',
        message: 'Some message content',
      });

      expect(mockPrisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            number: 'TKT-000043',
          }),
        }),
      );
    });

    it('defaults priority to MEDIUM when not specified', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);
      mockPrisma.ticket.findFirst.mockResolvedValue(null);
      mockPrisma.ticket.create.mockResolvedValue({
        ...TEST_TICKET,
        priority: 'MEDIUM',
        messages: [],
      });

      await createTicket(TEST_USER.id, {
        subject: 'Default priority ticket',
        message: 'Some message',
      });

      expect(mockPrisma.ticket.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            priority: 'MEDIUM',
          }),
        }),
      );
    });

    it('rejects subject shorter than 5 characters', async () => {
      await expect(
        createTicket(TEST_USER.id, {
          subject: 'Hi',
          message: 'Valid message content',
        }),
      ).rejects.toThrow('Subject must be at least 5 characters');
    });

    it('rejects subject longer than 200 characters', async () => {
      const longSubject = 'a'.repeat(201);

      await expect(
        createTicket(TEST_USER.id, {
          subject: longSubject,
          message: 'Valid message content',
        }),
      ).rejects.toThrow('Subject must be at most 200 characters');
    });

    it('rejects whitespace-only subject', async () => {
      await expect(
        createTicket(TEST_USER.id, {
          subject: '    ',
          message: 'Valid message content',
        }),
      ).rejects.toThrow('Subject must be at least 5 characters');
    });

    it('rejects empty message', async () => {
      await expect(
        createTicket(TEST_USER.id, {
          subject: 'Valid subject here',
          message: '   ',
        }),
      ).rejects.toThrow('Message content must be at least 1 character');
    });
  });

  // ─── assignTicket ────────────────────────────────────────────────────────

  describe('assignTicket', () => {
    it('assigns ticket to a MANAGER', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({ id: TEST_TICKET.id });
      mockPrisma.user.findUnique.mockResolvedValue(TEST_MANAGER);
      mockPrisma.ticket.update.mockResolvedValue({
        ...TEST_TICKET,
        assignedToId: TEST_MANAGER.id,
        user: TEST_USER,
        assignedTo: TEST_MANAGER,
      });

      const result = await assignTicket(TEST_TICKET.id, TEST_MANAGER.id);

      expect(result.assignedToId).toBe(TEST_MANAGER.id);
      expect(mockPrisma.ticket.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { assignedToId: TEST_MANAGER.id },
        }),
      );
    });

    it('assigns ticket to an ADMIN', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({ id: TEST_TICKET.id });
      mockPrisma.user.findUnique.mockResolvedValue(TEST_ADMIN);
      mockPrisma.ticket.update.mockResolvedValue({
        ...TEST_TICKET,
        assignedToId: TEST_ADMIN.id,
        user: TEST_USER,
        assignedTo: TEST_ADMIN,
      });

      const result = await assignTicket(TEST_TICKET.id, TEST_ADMIN.id);

      expect(result.assignedToId).toBe(TEST_ADMIN.id);
    });

    it('rejects assignment to a CLIENT user', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({ id: TEST_TICKET.id });
      mockPrisma.user.findUnique.mockResolvedValue(TEST_USER);

      await expect(
        assignTicket(TEST_TICKET.id, TEST_USER.id),
      ).rejects.toThrow('Ticket can only be assigned to a user with MANAGER or ADMIN role');
    });

    it('throws NotFoundError for non-existent ticket', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue(null);

      await expect(
        assignTicket('non-existent', TEST_MANAGER.id),
      ).rejects.toThrow('Ticket not found');
    });

    it('throws NotFoundError for non-existent manager', async () => {
      mockPrisma.ticket.findUnique.mockResolvedValue({ id: TEST_TICKET.id });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        assignTicket(TEST_TICKET.id, 'non-existent'),
      ).rejects.toThrow('Manager not found');
    });
  });

  // ─── VALID_STATUS_TRANSITIONS completeness ───────────────────────────────

  describe('VALID_STATUS_TRANSITIONS', () => {
    it('defines transitions for all statuses', () => {
      const allStatuses: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'WAITING_CUSTOMER', 'RESOLVED', 'CLOSED'];
      for (const status of allStatuses) {
        expect(VALID_STATUS_TRANSITIONS).toHaveProperty(status);
        expect(Array.isArray(VALID_STATUS_TRANSITIONS[status])).toBe(true);
      }
    });

    it('CLOSED has no outgoing transitions (terminal state)', () => {
      expect(VALID_STATUS_TRANSITIONS.CLOSED).toEqual([]);
    });
  });
});
