import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  sendEmail,
  setTransporter,
  buildOrderConfirmationTemplate,
  buildOrderStatusChangeTemplate,
  buildTicketNotificationTemplate,
  buildQuoteNotificationTemplate,
} from './email.service.js';
import type { Transporter } from 'nodemailer';

describe('email.service', () => {
  let mockSendMail: ReturnType<typeof vi.fn>;
  let mockTransporter: Partial<Transporter>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockSendMail = vi.fn();
    mockTransporter = { sendMail: mockSendMail } as unknown as Partial<Transporter>;
    setTransporter(mockTransporter as Transporter);
  });

  afterEach(() => {
    vi.useRealTimers();
    setTransporter(null);
  });

  describe('sendEmail - retry logic', () => {
    it('should send email successfully on first attempt', async () => {
      mockSendMail.mockResolvedValueOnce({ messageId: 'test-id' });

      await sendEmail('test@example.com', 'Test Subject', '<p>Hello</p>');

      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Test Subject',
          html: '<p>Hello</p>',
        }),
      );
    });

    it('should retry up to 3 times on failure with exponential backoff', async () => {
      mockSendMail
        .mockRejectedValueOnce(new Error('Connection refused'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockRejectedValueOnce(new Error('Server error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const sendPromise = sendEmail('test@example.com', 'Test', '<p>Hi</p>');

      // First attempt fails immediately, then waits 1s
      await vi.advanceTimersByTimeAsync(1000);
      // Second attempt fails, then waits 2s
      await vi.advanceTimersByTimeAsync(2000);
      // Third attempt fails, no more retries

      await sendPromise;

      expect(mockSendMail).toHaveBeenCalledTimes(3);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Attempt 1/3 failed'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Attempt 2/3 failed'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Attempt 3/3 failed'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('All 3 attempts failed'),
      );

      consoleSpy.mockRestore();
    });

    it('should succeed on second attempt after first failure', async () => {
      mockSendMail
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce({ messageId: 'success-id' });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const sendPromise = sendEmail('test@example.com', 'Test', '<p>Hi</p>');

      // First attempt fails, waits 1s backoff
      await vi.advanceTimersByTimeAsync(1000);

      await sendPromise;

      expect(mockSendMail).toHaveBeenCalledTimes(2);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Attempt 1/3 failed'),
      );

      consoleSpy.mockRestore();
    });

    it('should use exponential backoff: 1s, 2s delays', async () => {
      mockSendMail
        .mockRejectedValueOnce(new Error('Fail 1'))
        .mockRejectedValueOnce(new Error('Fail 2'))
        .mockResolvedValueOnce({ messageId: 'ok' });

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const sendPromise = sendEmail('test@example.com', 'Test', '<p>Hi</p>');

      // After first failure, should wait 1s (1000 * 2^0)
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(999);
      expect(mockSendMail).toHaveBeenCalledTimes(1); // Still waiting
      await vi.advanceTimersByTimeAsync(1);
      expect(mockSendMail).toHaveBeenCalledTimes(2); // Second attempt

      // After second failure, should wait 2s (1000 * 2^1)
      await vi.advanceTimersByTimeAsync(1999);
      expect(mockSendMail).toHaveBeenCalledTimes(2); // Still waiting
      await vi.advanceTimersByTimeAsync(1);
      expect(mockSendMail).toHaveBeenCalledTimes(3); // Third attempt

      await sendPromise;

      consoleSpy.mockRestore();
    });

    it('should never throw even when all retries fail', async () => {
      mockSendMail.mockRejectedValue(new Error('Permanent failure'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const sendPromise = sendEmail('test@example.com', 'Test', '<p>Hi</p>');

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(2000);

      // Should resolve without throwing
      await expect(sendPromise).resolves.toBeUndefined();

      consoleSpy.mockRestore();
    });

    it('should handle multiple recipients as comma-separated string', async () => {
      mockSendMail.mockResolvedValueOnce({ messageId: 'test-id' });

      await sendEmail(
        ['manager1@example.com', 'manager2@example.com'],
        'Test',
        '<p>Hi</p>',
      );

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'manager1@example.com, manager2@example.com',
        }),
      );
    });
  });

  describe('buildOrderConfirmationTemplate', () => {
    it('should generate correct subject and include order details', () => {
      const result = buildOrderConfirmationTemplate({
        orderNumber: 'ORD-000001',
        customerEmail: 'customer@example.com',
        customerName: 'John Doe',
        items: [
          { productName: 'Dell PowerEdge R740', quantity: 2, unitPrice: 3499.99 },
          { productName: 'HP ProLiant DL380', quantity: 1, unitPrice: 2899.0 },
        ],
        totalAmount: 9898.98,
        deliveryAddress: '123 Main St, City',
      });

      expect(result.subject).toBe('Order Confirmation - ORD-000001');
      expect(result.html).toContain('ORD-000001');
      expect(result.html).toContain('John Doe');
      expect(result.html).toContain('Dell PowerEdge R740');
      expect(result.html).toContain('HP ProLiant DL380');
      expect(result.html).toContain('$3499.99');
      expect(result.html).toContain('$9898.98');
      expect(result.html).toContain('123 Main St, City');
    });

    it('should omit delivery address when not provided', () => {
      const result = buildOrderConfirmationTemplate({
        orderNumber: 'ORD-000002',
        customerEmail: 'customer@example.com',
        customerName: 'Jane',
        items: [{ productName: 'Server', quantity: 1, unitPrice: 1000 }],
        totalAmount: 1000,
      });

      expect(result.html).not.toContain('Delivery Address');
    });
  });

  describe('buildOrderStatusChangeTemplate', () => {
    it('should generate correct subject and include status details', () => {
      const result = buildOrderStatusChangeTemplate({
        orderNumber: 'ORD-000001',
        customerEmail: 'customer@example.com',
        customerName: 'John Doe',
        previousStatus: 'PENDING',
        newStatus: 'CONFIRMED',
        note: 'Your order has been confirmed by our team.',
      });

      expect(result.subject).toBe('Order ORD-000001 - Status Changed to CONFIRMED');
      expect(result.html).toContain('ORD-000001');
      expect(result.html).toContain('PENDING');
      expect(result.html).toContain('CONFIRMED');
      expect(result.html).toContain('Your order has been confirmed by our team.');
    });

    it('should omit note when not provided', () => {
      const result = buildOrderStatusChangeTemplate({
        orderNumber: 'ORD-000001',
        customerEmail: 'customer@example.com',
        customerName: 'John',
        previousStatus: 'CONFIRMED',
        newStatus: 'PROCESSING',
      });

      expect(result.html).not.toContain('<strong>Note:</strong>');
    });
  });

  describe('buildTicketNotificationTemplate', () => {
    it('should generate correct subject and include message content', () => {
      const result = buildTicketNotificationTemplate({
        ticketNumber: 'TKT-000001',
        subject: 'Server not booting',
        messageContent: 'I tried rebooting but it still does not work.',
        senderName: 'John Doe',
      });

      expect(result.subject).toBe('[TKT-000001] New message: Server not booting');
      expect(result.html).toContain('TKT-000001');
      expect(result.html).toContain('Server not booting');
      expect(result.html).toContain('I tried rebooting but it still does not work.');
      expect(result.html).toContain('John Doe');
    });
  });

  describe('buildQuoteNotificationTemplate', () => {
    it('should generate correct subject and include configuration details', () => {
      const result = buildQuoteNotificationTemplate({
        quoteId: 'quote-123',
        workloadType: 'Database Server',
        cpuParams: { family: 'Xeon', cores: '16-32', count: 2, frequency: '2.4-3.6 GHz' },
        ramParams: { size: '128-256 GB', type: 'DDR5', frequency: '4800 MHz' },
        storageParams: { type: 'NVMe', size: '2-4 TB', hotSwap: true, count: 4 },
        contactName: 'Jane Smith',
        contactEmail: 'jane@company.com',
        contactPhone: '+1-555-0123',
        company: 'Acme Corp',
      });

      expect(result.subject).toBe('New Quote Request from Jane Smith - Database Server');
      expect(result.html).toContain('quote-123');
      expect(result.html).toContain('Database Server');
      expect(result.html).toContain('Xeon');
      expect(result.html).toContain('DDR5');
      expect(result.html).toContain('NVMe');
      expect(result.html).toContain('Jane Smith');
      expect(result.html).toContain('jane@company.com');
      expect(result.html).toContain('+1-555-0123');
      expect(result.html).toContain('Acme Corp');
    });

    it('should handle missing optional params', () => {
      const result = buildQuoteNotificationTemplate({
        quoteId: 'quote-456',
        workloadType: 'Web Server',
        contactName: 'Bob',
        contactEmail: 'bob@test.com',
        contactPhone: '555-0000',
      });

      expect(result.subject).toContain('Bob');
      expect(result.subject).toContain('Web Server');
      expect(result.html).toContain('quote-456');
      expect(result.html).not.toContain('Company');
    });
  });
});
