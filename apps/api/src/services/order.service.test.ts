import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma with $transaction support
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    $transaction: vi.fn(),
    order: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { prisma } from '../lib/prisma.js';
import {
  createOrder,
  getOrderById,
  getUserOrders,
  getAdminOrders,
  updateOrderStatus,
  ORDER_STATUS_TRANSITIONS,
} from './order.service.js';
import { StatusTransitionError } from '../utils/errors.js';

const mockPrisma = prisma as unknown as {
  $transaction: ReturnType<typeof vi.fn>;
  order: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

// ─── Test Data ───────────────────────────────────────────────────────────────

const TEST_USER_ID = 'user-123';

const TEST_PRODUCTS = [
  {
    id: 'product-1',
    name: 'Dell PowerEdge R740',
    slug: 'dell-poweredge-r740',
    price: { toString: () => '2499.99' },
    stockStatus: 'IN_STOCK',
    isActive: true,
  },
  {
    id: 'product-2',
    name: 'HP ProLiant DL380',
    slug: 'hp-proliant-dl380',
    price: { toString: () => '1899.50' },
    stockStatus: 'IN_STOCK',
    isActive: true,
  },
];

const TEST_ORDER_INPUT = {
  items: [
    { productId: 'product-1', quantity: 2 },
    { productId: 'product-2', quantity: 1 },
  ],
  contactName: 'John Doe',
  contactEmail: 'john@example.com',
  contactPhone: '+1234567890',
  company: 'Acme Corp',
  deliveryAddress: '123 Main St',
};

const TEST_ORDER = {
  id: 'order-1',
  orderNumber: 'ORD-000001',
  userId: TEST_USER_ID,
  contactName: 'John Doe',
  phone: '+1234567890',
  email: 'john@example.com',
  company: 'Acme Corp',
  comment: null,
  deliveryAddress: '123 Main St',
  status: 'PENDING',
  statusHistory: JSON.stringify([
    { from: null, to: 'PENDING', changedBy: TEST_USER_ID, changedAt: '2024-01-01T00:00:00.000Z', note: 'Order created' },
  ]),
  totalAmount: 6899.48,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  items: [
    {
      id: 'item-1',
      orderId: 'order-1',
      productId: 'product-1',
      productName: 'Dell PowerEdge R740',
      productSlug: 'dell-poweredge-r740',
      quantity: 2,
      unitPrice: 2499.99,
      totalPrice: 4999.98,
    },
    {
      id: 'item-2',
      orderId: 'order-1',
      productId: 'product-2',
      productName: 'HP ProLiant DL380',
      productSlug: 'hp-proliant-dl380',
      quantity: 1,
      unitPrice: 1899.50,
      totalPrice: 1899.50,
    },
  ],
};

describe('Order Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── createOrder ─────────────────────────────────────────────────────────

  describe('createOrder', () => {
    it('creates an order with price snapshots and correct totals', async () => {
      // Mock the transaction to execute the callback with a mock tx
      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          product: {
            findMany: vi.fn().mockResolvedValue(TEST_PRODUCTS),
          },
          order: {
            count: vi.fn().mockResolvedValue(0),
            create: vi.fn().mockResolvedValue(TEST_ORDER),
          },
          cartItem: {
            deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
          },
        };
        return callback(tx);
      });

      const result = await createOrder(TEST_USER_ID, TEST_ORDER_INPUT);

      expect(result).toEqual(TEST_ORDER);
      expect(result.orderNumber).toBe('ORD-000001');
      expect(result.status).toBe('PENDING');

      // Verify the transaction was called
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('snapshots product prices at order creation time', async () => {
      let createArgs: unknown = null;

      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          product: {
            findMany: vi.fn().mockResolvedValue(TEST_PRODUCTS),
          },
          order: {
            count: vi.fn().mockResolvedValue(0),
            create: vi.fn().mockImplementation((args: unknown) => {
              createArgs = args;
              return TEST_ORDER;
            }),
          },
          cartItem: {
            deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
          },
        };
        return callback(tx);
      });

      await createOrder(TEST_USER_ID, TEST_ORDER_INPUT);

      // Verify price snapshots in the create call
      const data = (createArgs as { data: { items: { create: Array<{ unitPrice: number; totalPrice: number; productName: string }> } } }).data;
      const items = data.items.create;

      // Product 1: price 2499.99, quantity 2
      expect(items[0]!.unitPrice).toBe(2499.99);
      expect(items[0]!.totalPrice).toBe(4999.98);
      expect(items[0]!.productName).toBe('Dell PowerEdge R740');

      // Product 2: price 1899.50, quantity 1
      expect(items[1]!.unitPrice).toBe(1899.50);
      expect(items[1]!.totalPrice).toBe(1899.50);
      expect(items[1]!.productName).toBe('HP ProLiant DL380');
    });

    it('calculates total as sum of (unitPrice × quantity)', async () => {
      let createArgs: unknown = null;

      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          product: {
            findMany: vi.fn().mockResolvedValue(TEST_PRODUCTS),
          },
          order: {
            count: vi.fn().mockResolvedValue(0),
            create: vi.fn().mockImplementation((args: unknown) => {
              createArgs = args;
              return TEST_ORDER;
            }),
          },
          cartItem: {
            deleteMany: vi.fn().mockResolvedValue({ count: 2 }),
          },
        };
        return callback(tx);
      });

      await createOrder(TEST_USER_ID, TEST_ORDER_INPUT);

      const data = (createArgs as { data: { totalAmount: number } }).data;
      // Total: (2499.99 × 2) + (1899.50 × 1) = 4999.98 + 1899.50 = 6899.48
      expect(data.totalAmount).toBe(6899.48);
    });

    it('throws ConflictError when product is out of stock', async () => {
      const outOfStockProducts = [
        { ...TEST_PRODUCTS[0], stockStatus: 'OUT_OF_STOCK' },
        TEST_PRODUCTS[1],
      ];

      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          product: {
            findMany: vi.fn().mockResolvedValue(outOfStockProducts),
          },
          order: {
            count: vi.fn(),
            create: vi.fn(),
          },
          cartItem: {
            deleteMany: vi.fn(),
          },
        };
        return callback(tx);
      });

      await expect(
        createOrder(TEST_USER_ID, TEST_ORDER_INPUT),
      ).rejects.toThrow('The following products are out of stock: Dell PowerEdge R740');
    });

    it('throws ConflictError with 409 status for out-of-stock products', async () => {
      const outOfStockProducts = [
        { ...TEST_PRODUCTS[0], stockStatus: 'OUT_OF_STOCK' },
        { ...TEST_PRODUCTS[1], stockStatus: 'OUT_OF_STOCK' },
      ];

      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          product: {
            findMany: vi.fn().mockResolvedValue(outOfStockProducts),
          },
          order: {
            count: vi.fn(),
            create: vi.fn(),
          },
          cartItem: {
            deleteMany: vi.fn(),
          },
        };
        return callback(tx);
      });

      try {
        await createOrder(TEST_USER_ID, TEST_ORDER_INPUT);
        expect.fail('Should have thrown');
      } catch (error: unknown) {
        const err = error as { statusCode: number; message: string };
        expect(err.statusCode).toBe(409);
        expect(err.message).toContain('Dell PowerEdge R740');
        expect(err.message).toContain('HP ProLiant DL380');
      }
    });

    it('generates sequential order numbers', async () => {
      let createArgs: unknown = null;

      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          product: {
            findMany: vi.fn().mockResolvedValue(TEST_PRODUCTS),
          },
          order: {
            count: vi.fn().mockResolvedValue(5), // 5 existing orders
            create: vi.fn().mockImplementation((args: unknown) => {
              createArgs = args;
              return { ...TEST_ORDER, orderNumber: 'ORD-000006' };
            }),
          },
          cartItem: {
            deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          },
        };
        return callback(tx);
      });

      await createOrder(TEST_USER_ID, TEST_ORDER_INPUT);

      const data = (createArgs as { data: { orderNumber: string } }).data;
      expect(data.orderNumber).toBe('ORD-000006');
    });

    it('generates ORD-000001 for the first order', async () => {
      let createArgs: unknown = null;

      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          product: {
            findMany: vi.fn().mockResolvedValue(TEST_PRODUCTS),
          },
          order: {
            count: vi.fn().mockResolvedValue(0), // no existing orders
            create: vi.fn().mockImplementation((args: unknown) => {
              createArgs = args;
              return TEST_ORDER;
            }),
          },
          cartItem: {
            deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
          },
        };
        return callback(tx);
      });

      await createOrder(TEST_USER_ID, TEST_ORDER_INPUT);

      const data = (createArgs as { data: { orderNumber: string } }).data;
      expect(data.orderNumber).toBe('ORD-000001');
    });

    it('clears user cart after successful order creation', async () => {
      let cartDeleteCalled = false;
      let cartDeleteArgs: unknown = null;

      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          product: {
            findMany: vi.fn().mockResolvedValue(TEST_PRODUCTS),
          },
          order: {
            count: vi.fn().mockResolvedValue(0),
            create: vi.fn().mockResolvedValue(TEST_ORDER),
          },
          cartItem: {
            deleteMany: vi.fn().mockImplementation((args: unknown) => {
              cartDeleteCalled = true;
              cartDeleteArgs = args;
              return { count: 2 };
            }),
          },
        };
        return callback(tx);
      });

      await createOrder(TEST_USER_ID, TEST_ORDER_INPUT);

      expect(cartDeleteCalled).toBe(true);
      expect(cartDeleteArgs).toEqual({ where: { userId: TEST_USER_ID } });
    });

    it('throws NotFoundError when product does not exist', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback: Function) => {
        const tx = {
          product: {
            findMany: vi.fn().mockResolvedValue([TEST_PRODUCTS[0]]), // Only one product found
          },
          order: {
            count: vi.fn(),
            create: vi.fn(),
          },
          cartItem: {
            deleteMany: vi.fn(),
          },
        };
        return callback(tx);
      });

      await expect(
        createOrder(TEST_USER_ID, TEST_ORDER_INPUT),
      ).rejects.toThrow('Products not found');
    });
  });

  // ─── getOrderById ────────────────────────────────────────────────────────

  describe('getOrderById', () => {
    it('returns order with items when user is the owner', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(TEST_ORDER);

      const result = await getOrderById('order-1', TEST_USER_ID);

      expect(result).toEqual(TEST_ORDER);
      expect(mockPrisma.order.findUnique).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        include: { items: true },
      });
    });

    it('throws NotFoundError when order does not exist', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(null);

      await expect(
        getOrderById('nonexistent', TEST_USER_ID),
      ).rejects.toThrow('Order not found');
    });

    it('throws NotFoundError when user is not the owner', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(TEST_ORDER);

      await expect(
        getOrderById('order-1', 'different-user'),
      ).rejects.toThrow('Order not found');
    });

    it('returns order without ownership check when userId is not provided', async () => {
      mockPrisma.order.findUnique.mockResolvedValue(TEST_ORDER);

      const result = await getOrderById('order-1');

      expect(result).toEqual(TEST_ORDER);
    });
  });

  // ─── getUserOrders ───────────────────────────────────────────────────────

  describe('getUserOrders', () => {
    it('returns paginated orders for a user', async () => {
      const orders = [TEST_ORDER];
      mockPrisma.order.count.mockResolvedValue(1);
      mockPrisma.order.findMany.mockResolvedValue(orders);

      const result = await getUserOrders(TEST_USER_ID, { limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(result.nextCursor).toBeNull();
    });

    it('returns nextCursor when there are more results', async () => {
      const orders = [
        { ...TEST_ORDER, id: 'order-1' },
        { ...TEST_ORDER, id: 'order-2' },
        { ...TEST_ORDER, id: 'order-3' }, // extra item indicating more pages
      ];
      mockPrisma.order.count.mockResolvedValue(5);
      mockPrisma.order.findMany.mockResolvedValue(orders);

      const result = await getUserOrders(TEST_USER_ID, { limit: 2 });

      expect(result.items).toHaveLength(2);
      expect(result.nextCursor).toBe('order-2');
      expect(result.totalCount).toBe(5);
    });

    it('uses cursor for pagination', async () => {
      mockPrisma.order.count.mockResolvedValue(5);
      mockPrisma.order.findMany.mockResolvedValue([]);

      await getUserOrders(TEST_USER_ID, { limit: 20, cursor: 'order-1' });

      expect(mockPrisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'order-1' },
          skip: 1,
        }),
      );
    });
  });

  // ─── getAdminOrders ──────────────────────────────────────────────────────

  describe('getAdminOrders', () => {
    it('returns all orders without filters', async () => {
      mockPrisma.order.count.mockResolvedValue(1);
      mockPrisma.order.findMany.mockResolvedValue([TEST_ORDER]);

      const result = await getAdminOrders({}, { limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.totalCount).toBe(1);
    });

    it('filters by status', async () => {
      mockPrisma.order.count.mockResolvedValue(0);
      mockPrisma.order.findMany.mockResolvedValue([]);

      await getAdminOrders({ status: 'PENDING' }, { limit: 20 });

      expect(mockPrisma.order.count).toHaveBeenCalledWith({
        where: { status: 'PENDING' },
      });
    });

    it('filters by date range', async () => {
      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-12-31');
      mockPrisma.order.count.mockResolvedValue(0);
      mockPrisma.order.findMany.mockResolvedValue([]);

      await getAdminOrders({ dateFrom, dateTo }, { limit: 20 });

      expect(mockPrisma.order.count).toHaveBeenCalledWith({
        where: { createdAt: { gte: dateFrom, lte: dateTo } },
      });
    });

    it('filters by customer email', async () => {
      mockPrisma.order.count.mockResolvedValue(0);
      mockPrisma.order.findMany.mockResolvedValue([]);

      await getAdminOrders({ customerEmail: 'john@example.com' }, { limit: 20 });

      expect(mockPrisma.order.count).toHaveBeenCalledWith({
        where: { email: { contains: 'john@example.com', mode: 'insensitive' } },
      });
    });
  });

  // ─── updateOrderStatus ───────────────────────────────────────────────────

  describe('updateOrderStatus', () => {
    const MANAGER_ID = 'manager-123';

    function makeOrder(status: string) {
      return {
        ...TEST_ORDER,
        status,
        statusHistory: JSON.stringify([
          { from: null, to: 'PENDING', changedBy: TEST_USER_ID, changedAt: '2024-01-01T00:00:00.000Z', note: 'Order created' },
        ]),
      };
    }

    describe('valid transitions', () => {
      const validTransitions: Array<[string, string]> = [
        ['PENDING', 'CONFIRMED'],
        ['PENDING', 'CANCELLED'],
        ['CONFIRMED', 'PROCESSING'],
        ['CONFIRMED', 'CANCELLED'],
        ['PROCESSING', 'SHIPPED'],
        ['PROCESSING', 'CANCELLED'],
        ['SHIPPED', 'DELIVERED'],
      ];

      it.each(validTransitions)(
        'allows transition from %s to %s',
        async (from, to) => {
          const order = makeOrder(from);
          mockPrisma.order.findUnique.mockResolvedValue(order);
          mockPrisma.order.update.mockResolvedValue({ ...order, status: to });

          const result = await updateOrderStatus('order-1', to as any, MANAGER_ID);

          expect(result.status).toBe(to);
          expect(mockPrisma.order.update).toHaveBeenCalledWith(
            expect.objectContaining({
              where: { id: 'order-1' },
              data: expect.objectContaining({
                status: to,
              }),
            }),
          );
        },
      );
    });

    describe('invalid transitions', () => {
      it('throws StatusTransitionError for PENDING → SHIPPED', async () => {
        const order = makeOrder('PENDING');
        mockPrisma.order.findUnique.mockResolvedValue(order);

        try {
          await updateOrderStatus('order-1', 'SHIPPED' as any, MANAGER_ID);
          expect.fail('Should have thrown');
        } catch (error: unknown) {
          expect(error).toBeInstanceOf(StatusTransitionError);
          const err = error as StatusTransitionError;
          expect(err.statusCode).toBe(422);
          expect(err.currentStatus).toBe('PENDING');
          expect(err.allowedTransitions).toEqual(['CONFIRMED', 'CANCELLED']);
        }
      });

      it('throws StatusTransitionError for PENDING → DELIVERED', async () => {
        const order = makeOrder('PENDING');
        mockPrisma.order.findUnique.mockResolvedValue(order);

        try {
          await updateOrderStatus('order-1', 'DELIVERED' as any, MANAGER_ID);
          expect.fail('Should have thrown');
        } catch (error: unknown) {
          expect(error).toBeInstanceOf(StatusTransitionError);
          const err = error as StatusTransitionError;
          expect(err.allowedTransitions).toEqual(['CONFIRMED', 'CANCELLED']);
        }
      });

      it('throws StatusTransitionError for CONFIRMED → DELIVERED', async () => {
        const order = makeOrder('CONFIRMED');
        mockPrisma.order.findUnique.mockResolvedValue(order);

        try {
          await updateOrderStatus('order-1', 'DELIVERED' as any, MANAGER_ID);
          expect.fail('Should have thrown');
        } catch (error: unknown) {
          expect(error).toBeInstanceOf(StatusTransitionError);
          const err = error as StatusTransitionError;
          expect(err.currentStatus).toBe('CONFIRMED');
          expect(err.allowedTransitions).toEqual(['PROCESSING', 'CANCELLED']);
        }
      });

      it('throws StatusTransitionError for SHIPPED → PROCESSING', async () => {
        const order = makeOrder('SHIPPED');
        mockPrisma.order.findUnique.mockResolvedValue(order);

        try {
          await updateOrderStatus('order-1', 'PROCESSING' as any, MANAGER_ID);
          expect.fail('Should have thrown');
        } catch (error: unknown) {
          expect(error).toBeInstanceOf(StatusTransitionError);
          const err = error as StatusTransitionError;
          expect(err.currentStatus).toBe('SHIPPED');
          expect(err.allowedTransitions).toEqual(['DELIVERED']);
        }
      });
    });

    describe('terminal states', () => {
      it('rejects all transitions from DELIVERED', async () => {
        const order = makeOrder('DELIVERED');
        mockPrisma.order.findUnique.mockResolvedValue(order);

        try {
          await updateOrderStatus('order-1', 'CANCELLED' as any, MANAGER_ID);
          expect.fail('Should have thrown');
        } catch (error: unknown) {
          expect(error).toBeInstanceOf(StatusTransitionError);
          const err = error as StatusTransitionError;
          expect(err.statusCode).toBe(422);
          expect(err.currentStatus).toBe('DELIVERED');
          expect(err.allowedTransitions).toEqual([]);
        }
      });

      it('rejects all transitions from CANCELLED', async () => {
        const order = makeOrder('CANCELLED');
        mockPrisma.order.findUnique.mockResolvedValue(order);

        try {
          await updateOrderStatus('order-1', 'PENDING' as any, MANAGER_ID);
          expect.fail('Should have thrown');
        } catch (error: unknown) {
          expect(error).toBeInstanceOf(StatusTransitionError);
          const err = error as StatusTransitionError;
          expect(err.statusCode).toBe(422);
          expect(err.currentStatus).toBe('CANCELLED');
          expect(err.allowedTransitions).toEqual([]);
        }
      });

      it('DELIVERED rejects transition to SHIPPED', async () => {
        const order = makeOrder('DELIVERED');
        mockPrisma.order.findUnique.mockResolvedValue(order);

        try {
          await updateOrderStatus('order-1', 'SHIPPED' as any, MANAGER_ID);
          expect.fail('Should have thrown');
        } catch (error: unknown) {
          expect(error).toBeInstanceOf(StatusTransitionError);
          const err = error as StatusTransitionError;
          expect(err.allowedTransitions).toEqual([]);
        }
      });
    });

    describe('status history', () => {
      it('appends status change to history with manager ID and timestamp', async () => {
        const order = makeOrder('PENDING');
        mockPrisma.order.findUnique.mockResolvedValue(order);
        mockPrisma.order.update.mockImplementation(async (args: any) => ({
          ...order,
          status: 'CONFIRMED',
          statusHistory: args.data.statusHistory,
        }));

        const result = await updateOrderStatus('order-1', 'CONFIRMED' as any, MANAGER_ID);

        const history = JSON.parse(result.statusHistory as string);
        expect(history).toHaveLength(2);
        expect(history[1]).toMatchObject({
          from: 'PENDING',
          to: 'CONFIRMED',
          changedBy: MANAGER_ID,
        });
        expect(history[1].changedAt).toBeDefined();
      });

      it('includes optional note in status history', async () => {
        const order = makeOrder('PENDING');
        mockPrisma.order.findUnique.mockResolvedValue(order);
        mockPrisma.order.update.mockImplementation(async (args: any) => ({
          ...order,
          status: 'CONFIRMED',
          statusHistory: args.data.statusHistory,
        }));

        const result = await updateOrderStatus(
          'order-1',
          'CONFIRMED' as any,
          MANAGER_ID,
          'Order verified by warehouse',
        );

        const history = JSON.parse(result.statusHistory as string);
        expect(history[1].note).toBe('Order verified by warehouse');
      });

      it('does not include note field when note is not provided', async () => {
        const order = makeOrder('PENDING');
        mockPrisma.order.findUnique.mockResolvedValue(order);
        mockPrisma.order.update.mockImplementation(async (args: any) => ({
          ...order,
          status: 'CONFIRMED',
          statusHistory: args.data.statusHistory,
        }));

        const result = await updateOrderStatus('order-1', 'CONFIRMED' as any, MANAGER_ID);

        const history = JSON.parse(result.statusHistory as string);
        expect(history[1]).not.toHaveProperty('note');
      });

      it('preserves existing history entries when appending', async () => {
        const existingHistory = [
          { from: null, to: 'PENDING', changedBy: TEST_USER_ID, changedAt: '2024-01-01T00:00:00.000Z', note: 'Order created' },
          { from: 'PENDING', to: 'CONFIRMED', changedBy: MANAGER_ID, changedAt: '2024-01-02T00:00:00.000Z' },
        ];
        const order = {
          ...TEST_ORDER,
          status: 'CONFIRMED',
          statusHistory: JSON.stringify(existingHistory),
        };
        mockPrisma.order.findUnique.mockResolvedValue(order);
        mockPrisma.order.update.mockImplementation(async (args: any) => ({
          ...order,
          status: 'PROCESSING',
          statusHistory: args.data.statusHistory,
        }));

        const result = await updateOrderStatus('order-1', 'PROCESSING' as any, MANAGER_ID);

        const history = JSON.parse(result.statusHistory as string);
        expect(history).toHaveLength(3);
        expect(history[0]).toEqual(existingHistory[0]);
        expect(history[1]).toEqual(existingHistory[1]);
        expect(history[2]).toMatchObject({
          from: 'CONFIRMED',
          to: 'PROCESSING',
          changedBy: MANAGER_ID,
        });
      });
    });

    describe('error cases', () => {
      it('throws NotFoundError when order does not exist', async () => {
        mockPrisma.order.findUnique.mockResolvedValue(null);

        await expect(
          updateOrderStatus('nonexistent', 'CONFIRMED' as any, MANAGER_ID),
        ).rejects.toThrow('Order not found');
      });
    });

    describe('ORDER_STATUS_TRANSITIONS constant', () => {
      it('defines correct transitions for PENDING', () => {
        expect(ORDER_STATUS_TRANSITIONS.PENDING).toEqual(['CONFIRMED', 'CANCELLED']);
      });

      it('defines correct transitions for CONFIRMED', () => {
        expect(ORDER_STATUS_TRANSITIONS.CONFIRMED).toEqual(['PROCESSING', 'CANCELLED']);
      });

      it('defines correct transitions for PROCESSING', () => {
        expect(ORDER_STATUS_TRANSITIONS.PROCESSING).toEqual(['SHIPPED', 'CANCELLED']);
      });

      it('defines correct transitions for SHIPPED', () => {
        expect(ORDER_STATUS_TRANSITIONS.SHIPPED).toEqual(['DELIVERED']);
      });

      it('defines empty transitions for DELIVERED (terminal)', () => {
        expect(ORDER_STATUS_TRANSITIONS.DELIVERED).toEqual([]);
      });

      it('defines empty transitions for CANCELLED (terminal)', () => {
        expect(ORDER_STATUS_TRANSITIONS.CANCELLED).toEqual([]);
      });
    });
  });
});
