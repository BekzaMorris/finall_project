import { prisma } from '../lib/prisma.js';
import { ConflictError, NotFoundError, StatusTransitionError } from '../utils/errors.js';
import type { OrderStatus } from '../generated/prisma/enums.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CreateOrderInput {
  items: Array<{ productId: string; quantity: number }>;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  company?: string;
  comment?: string;
  deliveryAddress?: string;
}

export interface OrderFilters {
  status?: string;
  dateFrom?: Date;
  dateTo?: Date;
  customerEmail?: string;
}

export interface CursorPagination {
  cursor?: string;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  prevCursor: string | null;
  totalCount: number;
}

export interface StatusHistoryEntry {
  from: string | null;
  to: string;
  changedBy: string;
  changedAt: string;
  note?: string;
}

// ─── Order Status Transitions ────────────────────────────────────────────────

/**
 * Valid order status transitions.
 * DELIVERED and CANCELLED are terminal states (no transitions allowed).
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

// ─── Order Service ───────────────────────────────────────────────────────────

/**
 * Create an order atomically within a database transaction.
 * - Validates product availability (rejects OUT_OF_STOCK with 409)
 * - Assigns sequential order number (ORD-NNNNNN)
 * - Snapshots product prices at order creation time
 * - Calculates total as sum of (unitPrice × quantity)
 * - Clears user cart on success
 */
export async function createOrder(
  userId: string,
  input: CreateOrderInput,
) {
  const order = await prisma.$transaction(async (tx) => {
    // Validate all products exist and are available
    const productIds = input.items.map((item) => item.productId);
    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
    });

    // Check all products exist
    const foundIds = new Set(products.map((p) => p.id));
    const missingIds = productIds.filter((id) => !foundIds.has(id));
    if (missingIds.length > 0) {
      throw new NotFoundError(
        `Products not found: ${missingIds.join(', ')}`,
      );
    }

    // Check stock status - reject OUT_OF_STOCK products
    const unavailableProducts = products.filter(
      (p) => p.stockStatus === 'OUT_OF_STOCK',
    );
    if (unavailableProducts.length > 0) {
      const names = unavailableProducts.map((p) => p.name).join(', ');
      throw new ConflictError(
        `The following products are out of stock: ${names}`,
      );
    }

    // Generate sequential order number
    const orderCount = await tx.order.count();
    const orderNumber = `ORD-${String(orderCount + 1).padStart(6, '0')}`;

    // Build order items with price snapshots and calculate totals
    const productMap = new Map(products.map((p) => [p.id, p]));
    const orderItems: Array<{
      productId: string;
      productName: string;
      productSlug: string;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
    }> = [];

    let totalAmount = 0;

    for (const item of input.items) {
      const product = productMap.get(item.productId)!;
      // Snapshot the current price as a number (Prisma Decimal → number)
      const unitPrice = Number(product.price);
      const totalPrice = Math.round(unitPrice * item.quantity * 100) / 100;

      orderItems.push({
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        quantity: item.quantity,
        unitPrice,
        totalPrice,
      });

      totalAmount = Math.round((totalAmount + totalPrice) * 100) / 100;
    }

    // Create the order with items
    const statusHistory: StatusHistoryEntry[] = [
      {
        from: null,
        to: 'PENDING',
        changedBy: userId,
        changedAt: new Date().toISOString(),
        note: 'Order created',
      },
    ];

    const createdOrder = await tx.order.create({
      data: {
        orderNumber,
        userId,
        contactName: input.contactName,
        phone: input.contactPhone,
        email: input.contactEmail,
        company: input.company ?? null,
        comment: input.comment ?? null,
        deliveryAddress: input.deliveryAddress ?? null,
        status: 'PENDING',
        statusHistory: JSON.stringify(statusHistory),
        totalAmount,
        items: {
          create: orderItems,
        },
      },
      include: {
        items: true,
      },
    });

    // Clear user's cart after successful order creation
    await tx.cartItem.deleteMany({
      where: { userId },
    });

    return createdOrder;
  });

  return order;
}

/**
 * Get an order by ID. Verifies ownership (userId must match) unless admin.
 */
export async function getOrderById(orderId: string, userId?: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
    },
  });

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  // If userId is provided, verify ownership
  if (userId && order.userId !== userId) {
    throw new NotFoundError('Order not found');
  }

  return order;
}

/**
 * Get a user's orders with cursor-based pagination, sorted by createdAt desc.
 */
export async function getUserOrders(
  userId: string,
  pagination: CursorPagination,
): Promise<PaginatedResult<unknown>> {
  const { cursor, limit } = pagination;

  const where = { userId };

  const totalCount = await prisma.order.count({ where });

  const orders = await prisma.order.findMany({
    where,
    include: {
      items: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1,
        }
      : {}),
  });

  const hasNext = orders.length > limit;
  const items = hasNext ? orders.slice(0, limit) : orders;

  return {
    items,
    nextCursor: hasNext ? items[items.length - 1]!.id : null,
    prevCursor: cursor ?? null,
    totalCount,
  };
}

/**
 * Get all orders for admin with filters and cursor-based pagination.
 */
export async function getAdminOrders(
  filters: OrderFilters,
  pagination: CursorPagination,
): Promise<PaginatedResult<unknown>> {
  const { cursor, limit } = pagination;

  // Build where clause from filters
  const where: Record<string, unknown> = {};

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.dateFrom || filters.dateTo) {
    const createdAt: Record<string, Date> = {};
    if (filters.dateFrom) {
      createdAt.gte = filters.dateFrom;
    }
    if (filters.dateTo) {
      createdAt.lte = filters.dateTo;
    }
    where.createdAt = createdAt;
  }

  if (filters.customerEmail) {
    where.email = { contains: filters.customerEmail, mode: 'insensitive' };
  }

  const totalCount = await prisma.order.count({ where });

  const orders = await prisma.order.findMany({
    where,
    include: {
      items: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1,
        }
      : {}),
  });

  const hasNext = orders.length > limit;
  const items = hasNext ? orders.slice(0, limit) : orders;

  return {
    items,
    nextCursor: hasNext ? items[items.length - 1]!.id : null,
    prevCursor: cursor ?? null,
    totalCount,
  };
}

/**
 * Update an order's status following the defined workflow transitions.
 * - Validates the transition is allowed
 * - Appends to statusHistory JSON array
 * - Returns the updated order
 *
 * @throws StatusTransitionError (422) if the transition is not allowed
 * @throws NotFoundError (404) if the order does not exist
 */
export async function updateOrderStatus(
  orderId: string,
  newStatus: OrderStatus,
  managerId: string,
  note?: string,
) {
  // Validate note length
  if (note && note.length > 500) {
    throw new StatusTransitionError(
      'UNKNOWN',
      [],
    );
  }

  // Fetch the current order
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) {
    throw new NotFoundError('Order not found');
  }

  const currentStatus = order.status as OrderStatus;
  const allowedTransitions = ORDER_STATUS_TRANSITIONS[currentStatus];

  // Validate the transition
  if (!allowedTransitions.includes(newStatus)) {
    throw new StatusTransitionError(currentStatus, allowedTransitions);
  }

  // Parse existing status history
  const existingHistory: StatusHistoryEntry[] = Array.isArray(order.statusHistory)
    ? (order.statusHistory as unknown as StatusHistoryEntry[])
    : JSON.parse(order.statusHistory as string || '[]');

  // Append new status change entry
  const historyEntry: StatusHistoryEntry = {
    from: currentStatus,
    to: newStatus,
    changedBy: managerId,
    changedAt: new Date().toISOString(),
    ...(note ? { note } : {}),
  };

  const updatedHistory = [...existingHistory, historyEntry];

  // Update the order
  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: newStatus,
      statusHistory: JSON.stringify(updatedHistory),
    },
    include: { items: true },
  });

  return updatedOrder;
}
