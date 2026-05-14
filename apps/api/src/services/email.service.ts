import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { env } from '../config/env.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OrderEmailData {
  orderNumber: string;
  customerEmail: string;
  customerName: string;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
  }>;
  totalAmount: number;
  deliveryAddress?: string;
}

export interface OrderStatusChangeData {
  orderNumber: string;
  customerEmail: string;
  customerName: string;
  previousStatus: string;
  newStatus: string;
  note?: string;
}

export interface TicketNotificationData {
  ticketNumber: string;
  subject: string;
  messageContent: string;
  senderName: string;
}

export interface QuoteNotificationData {
  quoteId: string;
  workloadType: string;
  cpuParams?: { family?: string; cores?: string; count?: number; frequency?: string; socket?: string };
  ramParams?: { size?: string; type?: string; frequency?: string };
  storageParams?: { type?: string; size?: string; hotSwap?: boolean; count?: number };
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  company?: string;
}

interface EmailTemplate {
  subject: string;
  html: string;
}

// ─── Configuration ───────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000; // 1 second

// ─── Transport ───────────────────────────────────────────────────────────────

let transporter: Transporter | null = null;

/**
 * Gets or creates the Nodemailer transporter configured with SMTP settings from env.
 */
export function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      ...(env.SMTP_USER
        ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } }
        : {}),
    });
  }
  return transporter;
}

/**
 * Allows overriding the transporter (useful for testing).
 */
export function setTransporter(t: Transporter | null): void {
  transporter = t;
}

// ─── Base Send with Retry ────────────────────────────────────────────────────

/**
 * Sends an email with retry logic using exponential backoff.
 * Retries up to 3 times with delays of 1s, 2s, 4s.
 * Logs failures without throwing (fire-and-forget).
 * Never blocks the calling operation.
 */
export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string,
): Promise<void> {
  const recipients = Array.isArray(to) ? to.join(', ') : to;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const transport = getTransporter();
      await transport.sendMail({
        from: env.SMTP_FROM,
        to: recipients,
        subject,
        html,
      });
      return; // Success
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        `[email] Attempt ${attempt}/${MAX_RETRIES} failed for "${subject}": ${errorMessage}`,
      );

      if (attempt < MAX_RETRIES) {
        const backoffMs = INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }
    }
  }

  // All retries exhausted
  console.error(
    `[email] All ${MAX_RETRIES} attempts failed for: "${subject}" to ${recipients}`,
  );
}

// ─── Async Wrapper (Fire-and-Forget) ─────────────────────────────────────────

/**
 * Wraps sendEmail in a fire-and-forget Promise.
 * Catches all errors and logs them — never rejects.
 * Never blocks the calling operation.
 */
export function sendEmailAsync(
  to: string | string[],
  subject: string,
  html: string,
): void {
  sendEmail(to, subject, html).catch((error) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[email] Unexpected error in sendEmailAsync: ${errorMessage}`);
  });
}

// ─── Email Templates ─────────────────────────────────────────────────────────

/**
 * Generates order confirmation email template.
 * Includes order number, items with quantities/prices, total, and delivery address.
 */
export function buildOrderConfirmationTemplate(order: OrderEmailData): EmailTemplate {
  const itemsHtml = order.items
    .map(
      (item) =>
        `<tr>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.productName}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${item.unitPrice.toFixed(2)}</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${(item.unitPrice * item.quantity).toFixed(2)}</td>
        </tr>`,
    )
    .join('');

  const deliveryHtml = order.deliveryAddress
    ? `<p><strong>Delivery Address:</strong> ${order.deliveryAddress}</p>`
    : '';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Order Confirmation</h2>
      <p>Hello ${order.customerName},</p>
      <p>Thank you for your order! Here are the details:</p>
      <p><strong>Order Number:</strong> ${order.orderNumber}</p>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <thead>
          <tr style="background-color: #f5f5f5;">
            <th style="padding: 8px; text-align: left;">Product</th>
            <th style="padding: 8px; text-align: center;">Qty</th>
            <th style="padding: 8px; text-align: right;">Unit Price</th>
            <th style="padding: 8px; text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="padding: 8px; text-align: right; font-weight: bold;">Order Total:</td>
            <td style="padding: 8px; text-align: right; font-weight: bold;">$${order.totalAmount.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
      ${deliveryHtml}
      <p>We will notify you when your order status changes.</p>
      <p style="color: #666; font-size: 12px;">This is an automated message from KiroPortal.</p>
    </div>
  `;

  return {
    subject: `Order Confirmation - ${order.orderNumber}`,
    html,
  };
}

/**
 * Generates order status change email template.
 * Includes order number, previous/new status, and optional note.
 */
export function buildOrderStatusChangeTemplate(data: OrderStatusChangeData): EmailTemplate {
  const noteHtml = data.note
    ? `<p><strong>Note:</strong> ${data.note}</p>`
    : '';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Order Status Update</h2>
      <p>Hello ${data.customerName},</p>
      <p>Your order <strong>${data.orderNumber}</strong> has been updated.</p>
      <table style="margin: 16px 0; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px; font-weight: bold;">Previous Status:</td>
          <td style="padding: 8px;">${data.previousStatus}</td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold;">New Status:</td>
          <td style="padding: 8px; color: #2563eb; font-weight: bold;">${data.newStatus}</td>
        </tr>
      </table>
      ${noteHtml}
      <p>If you have any questions, please contact our support team.</p>
      <p style="color: #666; font-size: 12px;">This is an automated message from KiroPortal.</p>
    </div>
  `;

  return {
    subject: `Order ${data.orderNumber} - Status Changed to ${data.newStatus}`,
    html,
  };
}

/**
 * Generates ticket notification email template.
 * Includes ticket number and new message content.
 */
export function buildTicketNotificationTemplate(
  data: TicketNotificationData,
): EmailTemplate {
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">New Ticket Message</h2>
      <p>A new message has been added to ticket <strong>${data.ticketNumber}</strong>:</p>
      <p><strong>Subject:</strong> ${data.subject}</p>
      <p><strong>From:</strong> ${data.senderName}</p>
      <div style="background-color: #f9f9f9; border-left: 4px solid #2563eb; padding: 12px; margin: 16px 0;">
        ${data.messageContent}
      </div>
      <p>Please log in to the portal to respond.</p>
      <p style="color: #666; font-size: 12px;">This is an automated message from KiroPortal.</p>
    </div>
  `;

  return {
    subject: `[${data.ticketNumber}] New message: ${data.subject}`,
    html,
  };
}

/**
 * Generates quote request notification email template.
 * Includes workload type, CPU/RAM/storage params, and contact info.
 */
export function buildQuoteNotificationTemplate(data: QuoteNotificationData): EmailTemplate {
  const cpuHtml = data.cpuParams
    ? `<tr>
        <td style="padding: 8px; font-weight: bold;">CPU:</td>
        <td style="padding: 8px;">
          ${data.cpuParams.family ? `Family: ${data.cpuParams.family}` : ''}
          ${data.cpuParams.cores ? ` | Cores: ${data.cpuParams.cores}` : ''}
          ${data.cpuParams.count ? ` | Count: ${data.cpuParams.count}` : ''}
          ${data.cpuParams.frequency ? ` | Frequency: ${data.cpuParams.frequency}` : ''}
          ${data.cpuParams.socket ? ` | Socket: ${data.cpuParams.socket}` : ''}
        </td>
      </tr>`
    : '';

  const ramHtml = data.ramParams
    ? `<tr>
        <td style="padding: 8px; font-weight: bold;">RAM:</td>
        <td style="padding: 8px;">
          ${data.ramParams.size ? `Size: ${data.ramParams.size}` : ''}
          ${data.ramParams.type ? ` | Type: ${data.ramParams.type}` : ''}
          ${data.ramParams.frequency ? ` | Frequency: ${data.ramParams.frequency}` : ''}
        </td>
      </tr>`
    : '';

  const storageHtml = data.storageParams
    ? `<tr>
        <td style="padding: 8px; font-weight: bold;">Storage:</td>
        <td style="padding: 8px;">
          ${data.storageParams.type ? `Type: ${data.storageParams.type}` : ''}
          ${data.storageParams.size ? ` | Size: ${data.storageParams.size}` : ''}
          ${data.storageParams.hotSwap !== undefined ? ` | Hot-Swap: ${data.storageParams.hotSwap ? 'Yes' : 'No'}` : ''}
          ${data.storageParams.count ? ` | Count: ${data.storageParams.count}` : ''}
        </td>
      </tr>`
    : '';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">New Quote Request</h2>
      <p>A new quote request has been submitted (ID: ${data.quoteId}).</p>
      
      <h3 style="color: #555;">Configuration</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 8px; font-weight: bold;">Workload Type:</td>
          <td style="padding: 8px;">${data.workloadType}</td>
        </tr>
        ${cpuHtml}
        ${ramHtml}
        ${storageHtml}
      </table>

      <h3 style="color: #555;">Contact Information</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 8px; font-weight: bold;">Name:</td>
          <td style="padding: 8px;">${data.contactName}</td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold;">Email:</td>
          <td style="padding: 8px;">${data.contactEmail}</td>
        </tr>
        <tr>
          <td style="padding: 8px; font-weight: bold;">Phone:</td>
          <td style="padding: 8px;">${data.contactPhone}</td>
        </tr>
        ${data.company ? `<tr><td style="padding: 8px; font-weight: bold;">Company:</td><td style="padding: 8px;">${data.company}</td></tr>` : ''}
      </table>

      <p>Please review and contact the customer.</p>
      <p style="color: #666; font-size: 12px;">This is an automated message from KiroPortal.</p>
    </div>
  `;

  return {
    subject: `New Quote Request from ${data.contactName} - ${data.workloadType}`,
    html,
  };
}

// ─── High-Level Send Functions ───────────────────────────────────────────────

/**
 * Sends an order confirmation email to the customer.
 * Fire-and-forget: never blocks the calling operation.
 */
export function sendOrderConfirmation(order: OrderEmailData): void {
  const { subject, html } = buildOrderConfirmationTemplate(order);
  sendEmailAsync(order.customerEmail, subject, html);
}

/**
 * Sends an order status change notification to the customer.
 * Fire-and-forget: never blocks the calling operation.
 */
export function sendOrderStatusChange(data: OrderStatusChangeData): void {
  const { subject, html } = buildOrderStatusChangeTemplate(data);
  sendEmailAsync(data.customerEmail, subject, html);
}

/**
 * Sends a ticket notification email to the specified recipient.
 * Fire-and-forget: never blocks the calling operation.
 */
export function sendTicketNotification(
  data: TicketNotificationData,
  recipientEmail: string | string[],
): void {
  const { subject, html } = buildTicketNotificationTemplate(data);
  sendEmailAsync(recipientEmail, subject, html);
}

/**
 * Sends a quote notification email to all managers.
 * Fire-and-forget: never blocks the calling operation.
 */
export function sendQuoteNotification(
  data: QuoteNotificationData,
  managerEmails: string[],
): void {
  const { subject, html } = buildQuoteNotificationTemplate(data);
  sendEmailAsync(managerEmails, subject, html);
}
