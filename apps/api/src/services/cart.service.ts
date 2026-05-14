import { prisma } from '../lib/prisma.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_QUANTITY_PER_ITEM = 99;
const MAX_DISTINCT_ITEMS = 50;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CartItemWithProduct {
  id: string;
  productId: string;
  quantity: number;
  createdAt: Date;
  product: {
    name: string;
    slug: string;
    price: unknown; // Prisma Decimal
    stockStatus: string;
    images: Array<{ url: string; alt: string | null }>;
  };
}

export interface CartSummary {
  items: CartItemWithProduct[];
  totalItems: number;
}

// ─── Cart Service ────────────────────────────────────────────────────────────

/**
 * Get all cart items for a user with product details.
 */
export async function getCart(userId: string): Promise<CartSummary> {
  const items = await prisma.cartItem.findMany({
    where: { userId },
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

  return {
    items: items as unknown as CartItemWithProduct[],
    totalItems: items.length,
  };
}

/**
 * Add an item to the cart or update quantity if it already exists.
 * Validates product exists and is active.
 * Enforces max 99 per item and max 50 distinct items per cart.
 */
export async function addToCart(
  userId: string,
  productId: string,
  quantity: number,
): Promise<CartItemWithProduct> {
  // Validate quantity
  if (quantity < 1 || quantity > MAX_QUANTITY_PER_ITEM) {
    throw new ValidationError(
      `Quantity must be between 1 and ${MAX_QUANTITY_PER_ITEM}`,
    );
  }

  // Validate product exists and is active
  const product = await prisma.product.findUnique({
    where: { id: productId },
  });

  if (!product || !product.isActive) {
    throw new NotFoundError('Product not found');
  }

  // Check if item already exists in cart
  const existingItem = await prisma.cartItem.findUnique({
    where: { userId_productId: { userId, productId } },
  });

  if (existingItem) {
    // Update quantity (sum of existing + new, capped at max)
    const newQuantity = existingItem.quantity + quantity;
    if (newQuantity > MAX_QUANTITY_PER_ITEM) {
      throw new ValidationError(
        `Quantity cannot exceed ${MAX_QUANTITY_PER_ITEM} per item`,
      );
    }

    const updated = await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: newQuantity },
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
    });

    return updated as unknown as CartItemWithProduct;
  }

  // Check max distinct items limit
  const currentCount = await prisma.cartItem.count({
    where: { userId },
  });

  if (currentCount >= MAX_DISTINCT_ITEMS) {
    throw new ValidationError(
      `Cart cannot contain more than ${MAX_DISTINCT_ITEMS} distinct items`,
    );
  }

  // Create new cart item
  const cartItem = await prisma.cartItem.create({
    data: {
      userId,
      productId,
      quantity,
    },
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
  });

  return cartItem as unknown as CartItemWithProduct;
}

/**
 * Update the quantity of a cart item.
 * If quantity is 0, removes the item.
 * Enforces max 99 per item.
 */
export async function updateQuantity(
  userId: string,
  productId: string,
  quantity: number,
): Promise<CartItemWithProduct | null> {
  // If quantity is 0, remove the item
  if (quantity === 0) {
    await removeFromCart(userId, productId);
    return null;
  }

  // Validate quantity range
  if (quantity < 0 || quantity > MAX_QUANTITY_PER_ITEM) {
    throw new ValidationError(
      `Quantity must be between 1 and ${MAX_QUANTITY_PER_ITEM}`,
    );
  }

  // Check item exists in cart
  const existingItem = await prisma.cartItem.findUnique({
    where: { userId_productId: { userId, productId } },
  });

  if (!existingItem) {
    throw new NotFoundError('Cart item not found');
  }

  const updated = await prisma.cartItem.update({
    where: { id: existingItem.id },
    data: { quantity },
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
  });

  return updated as unknown as CartItemWithProduct;
}

/**
 * Remove a specific item from the cart.
 */
export async function removeFromCart(
  userId: string,
  productId: string,
): Promise<void> {
  const existingItem = await prisma.cartItem.findUnique({
    where: { userId_productId: { userId, productId } },
  });

  if (!existingItem) {
    throw new NotFoundError('Cart item not found');
  }

  await prisma.cartItem.delete({
    where: { id: existingItem.id },
  });
}

/**
 * Remove all items from a user's cart.
 */
export async function clearCart(userId: string): Promise<void> {
  await prisma.cartItem.deleteMany({
    where: { userId },
  });
}

/**
 * Get the number of distinct items in a user's cart.
 */
export async function getCartCount(userId: string): Promise<number> {
  return prisma.cartItem.count({
    where: { userId },
  });
}
