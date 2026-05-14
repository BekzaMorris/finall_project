import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('../lib/prisma.js', () => ({
  prisma: {
    cartItem: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    product: {
      findUnique: vi.fn(),
    },
  },
}));

import { prisma } from '../lib/prisma.js';
import {
  getCart,
  addToCart,
  updateQuantity,
  removeFromCart,
  clearCart,
  getCartCount,
} from './cart.service.js';

const mockPrisma = prisma as unknown as {
  cartItem: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  product: {
    findUnique: ReturnType<typeof vi.fn>;
  };
};

// ─── Test Data ───────────────────────────────────────────────────────────────

const TEST_USER_ID = 'user-123';
const TEST_PRODUCT_ID = 'product-456';

const TEST_PRODUCT = {
  id: TEST_PRODUCT_ID,
  slug: 'dell-poweredge-r740',
  name: 'Dell PowerEdge R740',
  price: 2499.99,
  stockStatus: 'IN_STOCK',
  isActive: true,
  images: [{ url: 'https://example.com/img.jpg', alt: 'Server image' }],
};

const TEST_CART_ITEM = {
  id: 'cart-item-1',
  userId: TEST_USER_ID,
  productId: TEST_PRODUCT_ID,
  quantity: 2,
  createdAt: new Date('2024-01-01'),
  product: {
    name: TEST_PRODUCT.name,
    slug: TEST_PRODUCT.slug,
    price: TEST_PRODUCT.price,
    stockStatus: TEST_PRODUCT.stockStatus,
    images: TEST_PRODUCT.images,
  },
};

describe('Cart Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── getCart ─────────────────────────────────────────────────────────────

  describe('getCart', () => {
    it('returns all cart items with product details', async () => {
      mockPrisma.cartItem.findMany.mockResolvedValue([TEST_CART_ITEM]);

      const result = await getCart(TEST_USER_ID);

      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.productId).toBe(TEST_PRODUCT_ID);
      expect(result.items[0]!.quantity).toBe(2);
      expect(result.items[0]!.product.name).toBe('Dell PowerEdge R740');
      expect(result.totalItems).toBe(1);

      expect(mockPrisma.cartItem.findMany).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID },
        include: {
          product: {
            select: {
              name: true,
              slug: true,
              price: true,
              stockStatus: true,
              images: {
                select: { url: true, alt: true },
                orderBy: { order: 'asc' },
                take: 1,
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('returns empty cart when user has no items', async () => {
      mockPrisma.cartItem.findMany.mockResolvedValue([]);

      const result = await getCart(TEST_USER_ID);

      expect(result.items).toHaveLength(0);
      expect(result.totalItems).toBe(0);
    });
  });

  // ─── addToCart ───────────────────────────────────────────────────────────

  describe('addToCart', () => {
    it('adds a new item to the cart', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(TEST_PRODUCT);
      mockPrisma.cartItem.findUnique.mockResolvedValue(null);
      mockPrisma.cartItem.count.mockResolvedValue(0);
      mockPrisma.cartItem.create.mockResolvedValue(TEST_CART_ITEM);

      const result = await addToCart(TEST_USER_ID, TEST_PRODUCT_ID, 2);

      expect(result.productId).toBe(TEST_PRODUCT_ID);
      expect(result.quantity).toBe(2);
      expect(mockPrisma.cartItem.create).toHaveBeenCalledWith({
        data: {
          userId: TEST_USER_ID,
          productId: TEST_PRODUCT_ID,
          quantity: 2,
        },
        include: expect.any(Object),
      });
    });

    it('updates quantity when item already exists in cart', async () => {
      const existingItem = { id: 'cart-item-1', userId: TEST_USER_ID, productId: TEST_PRODUCT_ID, quantity: 3 };
      mockPrisma.product.findUnique.mockResolvedValue(TEST_PRODUCT);
      mockPrisma.cartItem.findUnique.mockResolvedValue(existingItem);
      mockPrisma.cartItem.update.mockResolvedValue({ ...TEST_CART_ITEM, quantity: 5 });

      const result = await addToCart(TEST_USER_ID, TEST_PRODUCT_ID, 2);

      expect(mockPrisma.cartItem.update).toHaveBeenCalledWith({
        where: { id: 'cart-item-1' },
        data: { quantity: 5 }, // 3 + 2
        include: expect.any(Object),
      });
      expect(result.quantity).toBe(5);
    });

    it('throws ValidationError when quantity exceeds 99', async () => {
      await expect(
        addToCart(TEST_USER_ID, TEST_PRODUCT_ID, 100),
      ).rejects.toThrow('Quantity must be between 1 and 99');
    });

    it('throws ValidationError when quantity is 0', async () => {
      await expect(
        addToCart(TEST_USER_ID, TEST_PRODUCT_ID, 0),
      ).rejects.toThrow('Quantity must be between 1 and 99');
    });

    it('throws ValidationError when combined quantity exceeds 99', async () => {
      const existingItem = { id: 'cart-item-1', userId: TEST_USER_ID, productId: TEST_PRODUCT_ID, quantity: 95 };
      mockPrisma.product.findUnique.mockResolvedValue(TEST_PRODUCT);
      mockPrisma.cartItem.findUnique.mockResolvedValue(existingItem);

      await expect(
        addToCart(TEST_USER_ID, TEST_PRODUCT_ID, 5),
      ).rejects.toThrow('Quantity cannot exceed 99 per item');
    });

    it('throws NotFoundError when product does not exist', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(null);

      await expect(
        addToCart(TEST_USER_ID, 'nonexistent-product', 1),
      ).rejects.toThrow('Product not found');
    });

    it('throws NotFoundError when product is inactive', async () => {
      mockPrisma.product.findUnique.mockResolvedValue({ ...TEST_PRODUCT, isActive: false });

      await expect(
        addToCart(TEST_USER_ID, TEST_PRODUCT_ID, 1),
      ).rejects.toThrow('Product not found');
    });

    it('throws ValidationError when cart has 50 distinct items', async () => {
      mockPrisma.product.findUnique.mockResolvedValue(TEST_PRODUCT);
      mockPrisma.cartItem.findUnique.mockResolvedValue(null);
      mockPrisma.cartItem.count.mockResolvedValue(50);

      await expect(
        addToCart(TEST_USER_ID, TEST_PRODUCT_ID, 1),
      ).rejects.toThrow('Cart cannot contain more than 50 distinct items');
    });
  });

  // ─── updateQuantity ──────────────────────────────────────────────────────

  describe('updateQuantity', () => {
    it('updates the quantity of an existing cart item', async () => {
      const existingItem = { id: 'cart-item-1', userId: TEST_USER_ID, productId: TEST_PRODUCT_ID, quantity: 2 };
      mockPrisma.cartItem.findUnique.mockResolvedValue(existingItem);
      mockPrisma.cartItem.update.mockResolvedValue({ ...TEST_CART_ITEM, quantity: 5 });

      const result = await updateQuantity(TEST_USER_ID, TEST_PRODUCT_ID, 5);

      expect(result).not.toBeNull();
      expect(result!.quantity).toBe(5);
      expect(mockPrisma.cartItem.update).toHaveBeenCalledWith({
        where: { id: 'cart-item-1' },
        data: { quantity: 5 },
        include: expect.any(Object),
      });
    });

    it('removes item when quantity is set to 0', async () => {
      const existingItem = { id: 'cart-item-1', userId: TEST_USER_ID, productId: TEST_PRODUCT_ID, quantity: 2 };
      mockPrisma.cartItem.findUnique.mockResolvedValue(existingItem);
      mockPrisma.cartItem.delete.mockResolvedValue(existingItem);

      const result = await updateQuantity(TEST_USER_ID, TEST_PRODUCT_ID, 0);

      expect(result).toBeNull();
      expect(mockPrisma.cartItem.delete).toHaveBeenCalled();
    });

    it('throws ValidationError when quantity exceeds 99', async () => {
      await expect(
        updateQuantity(TEST_USER_ID, TEST_PRODUCT_ID, 100),
      ).rejects.toThrow('Quantity must be between 1 and 99');
    });

    it('throws ValidationError for negative quantity', async () => {
      await expect(
        updateQuantity(TEST_USER_ID, TEST_PRODUCT_ID, -1),
      ).rejects.toThrow('Quantity must be between 1 and 99');
    });

    it('throws NotFoundError when cart item does not exist', async () => {
      mockPrisma.cartItem.findUnique.mockResolvedValue(null);

      await expect(
        updateQuantity(TEST_USER_ID, 'nonexistent-product', 5),
      ).rejects.toThrow('Cart item not found');
    });
  });

  // ─── removeFromCart ──────────────────────────────────────────────────────

  describe('removeFromCart', () => {
    it('removes an item from the cart', async () => {
      const existingItem = { id: 'cart-item-1', userId: TEST_USER_ID, productId: TEST_PRODUCT_ID, quantity: 2 };
      mockPrisma.cartItem.findUnique.mockResolvedValue(existingItem);
      mockPrisma.cartItem.delete.mockResolvedValue(existingItem);

      await removeFromCart(TEST_USER_ID, TEST_PRODUCT_ID);

      expect(mockPrisma.cartItem.delete).toHaveBeenCalledWith({
        where: { id: 'cart-item-1' },
      });
    });

    it('throws NotFoundError when item does not exist in cart', async () => {
      mockPrisma.cartItem.findUnique.mockResolvedValue(null);

      await expect(
        removeFromCart(TEST_USER_ID, 'nonexistent-product'),
      ).rejects.toThrow('Cart item not found');
    });
  });

  // ─── clearCart ───────────────────────────────────────────────────────────

  describe('clearCart', () => {
    it('removes all items from the cart', async () => {
      mockPrisma.cartItem.deleteMany.mockResolvedValue({ count: 3 });

      await clearCart(TEST_USER_ID);

      expect(mockPrisma.cartItem.deleteMany).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID },
      });
    });

    it('succeeds even when cart is already empty', async () => {
      mockPrisma.cartItem.deleteMany.mockResolvedValue({ count: 0 });

      await expect(clearCart(TEST_USER_ID)).resolves.not.toThrow();
    });
  });

  // ─── getCartCount ────────────────────────────────────────────────────────

  describe('getCartCount', () => {
    it('returns the number of distinct items in the cart', async () => {
      mockPrisma.cartItem.count.mockResolvedValue(5);

      const count = await getCartCount(TEST_USER_ID);

      expect(count).toBe(5);
      expect(mockPrisma.cartItem.count).toHaveBeenCalledWith({
        where: { userId: TEST_USER_ID },
      });
    });

    it('returns 0 for empty cart', async () => {
      mockPrisma.cartItem.count.mockResolvedValue(0);

      const count = await getCartCount(TEST_USER_ID);

      expect(count).toBe(0);
    });
  });
});
