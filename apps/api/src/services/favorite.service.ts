import { prisma } from '../lib/prisma.js';
import { NotFoundError } from '../utils/errors.js';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CursorPagination {
  cursor?: string;
  limit: number;
}

interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  totalCount: number;
}

// ─── Service Functions ───────────────────────────────────────────────────────

/**
 * Get the authenticated user's favorites list with cursor-based pagination.
 * Excludes products where isActive = false (soft-deleted from catalog).
 * Includes product details: name, slug, price, stockStatus, condition, images.
 */
export async function getUserFavorites(
  userId: string,
  pagination: CursorPagination,
): Promise<PaginatedResult<unknown>> {
  const { cursor, limit } = pagination;

  const favorites = await prisma.favorite.findMany({
    where: {
      userId,
      product: { isActive: true },
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          stockStatus: true,
          condition: true,
          images: {
            take: 1,
            orderBy: { order: 'asc' },
            select: { id: true, url: true, alt: true },
          },
        },
      },
    },
  });

  const hasNext = favorites.length > limit;
  const items = hasNext ? favorites.slice(0, limit) : favorites;

  const totalCount = await prisma.favorite.count({
    where: {
      userId,
      product: { isActive: true },
    },
  });

  return {
    items,
    nextCursor: hasNext ? items[items.length - 1]!.id : null,
    totalCount,
  };
}

/**
 * Add a product to the user's favorites.
 * Idempotent: if already favorited, returns success without creating a duplicate.
 * Throws NotFoundError if the product does not exist or is inactive.
 */
export async function addFavorite(userId: string, productId: string): Promise<void> {
  // Check product exists and is active
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, isActive: true },
  });

  if (!product || !product.isActive) {
    throw new NotFoundError('Product not found');
  }

  // Idempotent upsert — no duplicate created if already exists
  await prisma.favorite.upsert({
    where: {
      userId_productId: { userId, productId },
    },
    create: { userId, productId },
    update: {}, // No-op if already exists
  });
}

/**
 * Remove a product from the user's favorites.
 * Idempotent: if not in favorites, returns success without error.
 */
export async function removeFavorite(userId: string, productId: string): Promise<void> {
  await prisma.favorite.deleteMany({
    where: { userId, productId },
  });
}
