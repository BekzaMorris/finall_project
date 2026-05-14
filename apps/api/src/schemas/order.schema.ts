import { z } from 'zod';

// ─── Order Status Enum ───────────────────────────────────────────────────────

const orderStatusEnum = z.enum([
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
]);

// ─── Create Order Schema ─────────────────────────────────────────────────────

export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.string().min(1, 'Product ID is required'),
        quantity: z
          .number()
          .int('Quantity must be an integer')
          .min(1, 'Quantity must be at least 1')
          .max(99, 'Quantity must be at most 99'),
      }).strict(),
    )
    .min(1, 'Order must contain at least one item'),
  contactName: z.string().min(1, 'Contact name is required').max(200),
  email: z.string().email('Invalid email format').max(255),
  phone: z.string().min(1, 'Phone is required').max(50),
  company: z.string().max(200).optional(),
  deliveryAddress: z.string().max(1000).optional(),
  notes: z.string().max(2000).optional(),
}).strict();

// ─── Update Order Status Schema ──────────────────────────────────────────────

export const updateOrderStatusSchema = z.object({
  status: orderStatusEnum,
  note: z.string().max(500, 'Note must be at most 500 characters').optional(),
}).strict();
