import { describe, it, expect } from 'vitest';
import { createTicketSchema, addMessageSchema } from './ticket.schema.js';

describe('Ticket Schema', () => {
  // ─── Create Ticket Schema ──────────────────────────────────────────────────

  describe('createTicketSchema', () => {
    const validTicket = {
      subject: 'Server not responding',
      message: 'My server has been down for 2 hours. Please help.',
    };

    it('accepts a valid ticket with minimal fields', () => {
      const result = createTicketSchema.parse(validTicket);
      expect(result.subject).toBe('Server not responding');
      expect(result.message).toBe('My server has been down for 2 hours. Please help.');
      expect(result.priority).toBe('MEDIUM'); // default
    });

    it('accepts a ticket with all fields', () => {
      const result = createTicketSchema.parse({
        ...validTicket,
        priority: 'HIGH',
        orderId: 'order-123',
      });
      expect(result.priority).toBe('HIGH');
      expect(result.orderId).toBe('order-123');
    });

    it('trims whitespace from subject', () => {
      const result = createTicketSchema.parse({
        ...validTicket,
        subject: '  Server issue  ',
      });
      expect(result.subject).toBe('Server issue');
    });

    it('trims whitespace from message', () => {
      const result = createTicketSchema.parse({
        ...validTicket,
        message: '  Help me please  ',
      });
      expect(result.message).toBe('Help me please');
    });

    // Subject validation
    it('rejects subject shorter than 5 characters', () => {
      expect(() =>
        createTicketSchema.parse({ ...validTicket, subject: 'Hi' }),
      ).toThrow();
    });

    it('rejects subject shorter than 5 characters after trimming', () => {
      expect(() =>
        createTicketSchema.parse({ ...validTicket, subject: '  Hi  ' }),
      ).toThrow();
    });

    it('rejects subject longer than 200 characters', () => {
      expect(() =>
        createTicketSchema.parse({ ...validTicket, subject: 'A'.repeat(201) }),
      ).toThrow();
    });

    it('rejects whitespace-only subject', () => {
      expect(() =>
        createTicketSchema.parse({ ...validTicket, subject: '     ' }),
      ).toThrow();
    });

    it('rejects subject with only tabs and newlines', () => {
      expect(() =>
        createTicketSchema.parse({ ...validTicket, subject: '\t\n\r  ' }),
      ).toThrow();
    });

    // Message validation
    it('rejects empty message', () => {
      expect(() =>
        createTicketSchema.parse({ ...validTicket, message: '' }),
      ).toThrow();
    });

    it('rejects whitespace-only message', () => {
      expect(() =>
        createTicketSchema.parse({ ...validTicket, message: '   ' }),
      ).toThrow();
    });

    it('rejects message longer than 5000 characters', () => {
      expect(() =>
        createTicketSchema.parse({ ...validTicket, message: 'A'.repeat(5001) }),
      ).toThrow();
    });

    it('accepts message at exactly 5000 characters', () => {
      const result = createTicketSchema.parse({
        ...validTicket,
        message: 'A'.repeat(5000),
      });
      expect(result.message.length).toBe(5000);
    });

    it('accepts subject at exactly 5 characters', () => {
      const result = createTicketSchema.parse({
        ...validTicket,
        subject: 'Hello',
      });
      expect(result.subject).toBe('Hello');
    });

    it('accepts subject at exactly 200 characters', () => {
      const result = createTicketSchema.parse({
        ...validTicket,
        subject: 'A'.repeat(200),
      });
      expect(result.subject.length).toBe(200);
    });

    // Priority validation
    it('rejects invalid priority', () => {
      expect(() =>
        createTicketSchema.parse({ ...validTicket, priority: 'CRITICAL' }),
      ).toThrow();
    });

    it('rejects unknown fields', () => {
      expect(() =>
        createTicketSchema.parse({ ...validTicket, unknownField: 'test' }),
      ).toThrow();
    });
  });

  // ─── Add Message Schema ────────────────────────────────────────────────────

  describe('addMessageSchema', () => {
    it('accepts a valid message', () => {
      const result = addMessageSchema.parse({ content: 'Thank you for the update.' });
      expect(result.content).toBe('Thank you for the update.');
      expect(result.isInternal).toBe(false); // default
    });

    it('accepts a message with isInternal flag', () => {
      const result = addMessageSchema.parse({
        content: 'Internal note for team',
        isInternal: true,
      });
      expect(result.isInternal).toBe(true);
    });

    it('accepts a message with attachments', () => {
      const result = addMessageSchema.parse({
        content: 'See attached screenshot',
        attachments: ['https://example.com/image1.png', 'https://example.com/image2.png'],
      });
      expect(result.attachments).toHaveLength(2);
    });

    it('trims whitespace from content', () => {
      const result = addMessageSchema.parse({ content: '  Hello world  ' });
      expect(result.content).toBe('Hello world');
    });

    it('rejects empty content', () => {
      expect(() => addMessageSchema.parse({ content: '' })).toThrow();
    });

    it('rejects whitespace-only content', () => {
      expect(() => addMessageSchema.parse({ content: '    ' })).toThrow();
    });

    it('rejects content with only newlines and tabs', () => {
      expect(() => addMessageSchema.parse({ content: '\n\t\r' })).toThrow();
    });

    it('rejects content longer than 5000 characters', () => {
      expect(() =>
        addMessageSchema.parse({ content: 'A'.repeat(5001) }),
      ).toThrow();
    });

    it('rejects more than 5 attachments', () => {
      expect(() =>
        addMessageSchema.parse({
          content: 'Too many files',
          attachments: [
            'https://example.com/1.png',
            'https://example.com/2.png',
            'https://example.com/3.png',
            'https://example.com/4.png',
            'https://example.com/5.png',
            'https://example.com/6.png',
          ],
        }),
      ).toThrow();
    });

    it('rejects invalid attachment URLs', () => {
      expect(() =>
        addMessageSchema.parse({
          content: 'Bad URL',
          attachments: ['not-a-url'],
        }),
      ).toThrow();
    });

    it('rejects unknown fields', () => {
      expect(() =>
        addMessageSchema.parse({ content: 'Hello', unknownField: true }),
      ).toThrow();
    });
  });
});
