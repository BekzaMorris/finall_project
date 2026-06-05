import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { requireAuth, requireAdmin } from '../../middleware/auth.js';
import { validateBody, validateQuery, validateParams } from '../../middleware/validate.js';
import { updateUserRoleSchema } from '../../schemas/user.schema.js';
import { prisma } from '../../lib/prisma.js';
import { redis } from '../../lib/redis.js';
import { ForbiddenError, NotFoundError } from '../../utils/errors.js';

// ─── Query Schemas ───────────────────────────────────────────────────────────

const adminUserQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  role: z.enum(['CLIENT', 'MANAGER', 'ADMIN']).optional(),
  isActive: z
    .enum(['true', 'false'])
    .transform((val) => val === 'true')
    .optional(),
  search: z.string().max(200).optional(),
});

const userIdParamsSchema = z.object({
  id: z.string().min(1, 'User ID is required'),
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Fields to select for user responses (excludes password) */
const userSelectFields = {
  id: true,
  email: true,
  name: true,
  company: true,
  phone: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Revoke all refresh tokens for a user by scanning Redis keys.
 * Refresh tokens are stored as `refresh:{token}` with value = userId.
 */
async function revokeAllRefreshTokens(userId: string): Promise<void> {
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(
      cursor,
      'MATCH',
      'refresh:*',
      'COUNT',
      100,
    );
    cursor = nextCursor;

    if (keys.length > 0) {
      // Check which keys belong to this user
      const values = await redis.mget(...keys);
      const keysToDelete = keys.filter(
        (_key, index) => values[index] === userId,
      );
      if (keysToDelete.length > 0) {
        await redis.del(...keysToDelete);
      }
    }
  } while (cursor !== '0');
}

// ─── Router ──────────────────────────────────────────────────────────────────

const router = Router();

/**
 * GET /api/admin/users
 * List all users with cursor-based pagination and optional filters.
 * Requires ADMIN role.
 */
router.get(
  '/',
  requireAuth,
  requireAdmin,
  validateQuery(adminUserQuerySchema),
  async (req: Request, res: Response): Promise<void> => {
    const { cursor, limit, role, isActive, search } =
      req.query as unknown as z.infer<typeof adminUserQuerySchema>;

    // Build where clause
    const where: Record<string, unknown> = {};
    if (role) {
      where.role = role;
    }
    if (isActive !== undefined) {
      where.isActive = isActive;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Cursor-based pagination
    const users = await prisma.user.findMany({
      where,
      select: userSelectFields,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
    });

    const hasNext = users.length > limit;
    const items = hasNext ? users.slice(0, limit) : users;
    const nextCursor = hasNext ? items[items.length - 1]?.id ?? null : null;

    const totalCount = await prisma.user.count({ where });

    res.status(200).json({
      items,
      nextCursor,
      totalCount,
    });
  },
);

/**
 * PATCH /api/admin/users/:id/role
 * Change a user's role.
 * Requires ADMIN role. Cannot change own role.
 */
router.patch(
  '/:id/role',
  requireAuth,
  requireAdmin,
  validateParams(userIdParamsSchema),
  validateBody(updateUserRoleSchema),
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const { role } = req.body;

    // Prevent admin from changing own role
    if (req.user!.userId === id) {
      throw new ForbiddenError('Cannot change your own role');
    }

    // Verify user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingUser) {
      throw new NotFoundError('User not found');
    }

    // Update role
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { role },
      select: userSelectFields,
    });

    // Invalidate cached permissions for this user
    // Delete any permission cache keys for this user
    const permCacheKey = `permissions:${id}`;
    await redis.del(permCacheKey);

    res.status(200).json(updatedUser);
  },
);

/**
 * PATCH /api/admin/users/:id/deactivate
 * Deactivate a user account.
 * Requires ADMIN role. Cannot deactivate own account.
 */
router.patch(
  '/:id/deactivate',
  requireAuth,
  requireAdmin,
  validateParams(userIdParamsSchema),
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;

    // Prevent admin from deactivating own account
    if (req.user!.userId === id) {
      throw new ForbiddenError('Cannot deactivate your own account');
    }

    // Verify user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingUser) {
      throw new NotFoundError('User not found');
    }

    // Deactivate user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isActive: false },
      select: userSelectFields,
    });

    // Revoke all refresh tokens for this user
    await revokeAllRefreshTokens(id);

    res.status(200).json(updatedUser);
  },
);

/**
 * PATCH /api/admin/users/:id/activate
 * Reactivate a user account.
 * Requires ADMIN role.
 */
router.patch(
  '/:id/activate',
  requireAuth,
  requireAdmin,
  validateParams(userIdParamsSchema),
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;

    // Verify user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingUser) {
      throw new NotFoundError('User not found');
    }

    // Activate user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { isActive: true },
      select: userSelectFields,
    });

    res.status(200).json(updatedUser);
  },
);

/**
 * POST /api/admin/users
 * Create a new user (admin can set any role).
 */
router.post(
  '/',
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const { email, password, name, role, company, phone } = req.body;

    if (!email || !password || !name) {
      res.status(400).json({ error: 'Email, password, and name are required' });
      return;
    }

    const bcrypt = await import('bcrypt');
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: 'Email already registered' });
      return;
    }

    const hashedPassword = await bcrypt.default.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role || 'CLIENT',
        company: company || null,
        phone: phone || null,
      },
    });

    const { password: _, ...safeUser } = user;
    res.status(201).json(safeUser);
  },
);

/**
 * DELETE /api/admin/users/:id
 * Delete a user permanently.
 */
router.delete(
  '/:id',
  requireAuth,
  requireAdmin,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;

    // Prevent self-deletion
    if (req.user!.userId === id) {
      res.status(403).json({ error: 'Cannot delete your own account' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Delete user's related data first
    await prisma.cartItem.deleteMany({ where: { userId: id } });
    await prisma.favorite.deleteMany({ where: { userId: id } });
    await prisma.ticketMessage.deleteMany({ where: { userId: id } });

    // Revoke all refresh tokens for this user
    try {
      const { redis } = await import('../../lib/redis.js');
      const keys = await redis.keys('refresh:*');
      for (const key of keys) {
        const storedUserId = await redis.get(key);
        if (storedUserId === id) {
          await redis.del(key);
        }
      }
    } catch {}

    await prisma.user.delete({ where: { id } });

    res.status(200).json({ message: 'User deleted', id });
  },
);

export { router as adminUserRouter };
