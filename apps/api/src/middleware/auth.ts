import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../services/auth.service.js';
import { AuthenticationError, ForbiddenError } from '../utils/errors.js';

// ─── TypeScript Augmentation ─────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email: string;
        role: string;
      };
    }
  }
}

// ─── Role Hierarchy ──────────────────────────────────────────────────────────

/**
 * Role hierarchy: ADMIN > MANAGER > CLIENT
 * Higher-level roles inherit all permissions of lower-level roles.
 */
const ROLE_HIERARCHY: Record<string, number> = {
  CLIENT: 1,
  MANAGER: 2,
  ADMIN: 3,
};

// ─── Middleware: requireAuth ─────────────────────────────────────────────────

/**
 * Validates JWT from Authorization header (Bearer token).
 * If valid, attaches decoded payload to req.user.
 * If missing or invalid, throws AuthenticationError (→ 401).
 */
export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AuthenticationError('Authentication required');
  }

  const token = authHeader.slice(7); // Remove 'Bearer ' prefix

  if (!token) {
    throw new AuthenticationError('Authentication required');
  }

  const payload = verifyAccessToken(token);

  if (!payload) {
    throw new AuthenticationError('Invalid or expired token');
  }

  req.user = payload;
  next();
}

// ─── Middleware Factory: requireRole ─────────────────────────────────────────

/**
 * Middleware factory that checks if the authenticated user's role
 * is in the allowed roles list.
 *
 * Must be used AFTER requireAuth (expects req.user to be set).
 *
 * Role hierarchy is enforced: ADMIN has all permissions,
 * MANAGER has MANAGER + CLIENT permissions.
 *
 * Throws ForbiddenError (→ 403) if the user's role is insufficient.
 */
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user) {
      throw new AuthenticationError('Authentication required');
    }

    const userRole = user.role;

    if (allowedRoles.includes(userRole)) {
      next();
      return;
    }

    // Check hierarchy: if user's role level is >= the minimum required level
    const userLevel = ROLE_HIERARCHY[userRole] ?? 0;
    const requiredLevel = Math.min(
      ...allowedRoles.map((role) => ROLE_HIERARCHY[role] ?? Infinity),
    );

    if (userLevel >= requiredLevel) {
      next();
      return;
    }

    throw new ForbiddenError('Insufficient permissions');
  };
}

// ─── Convenience Exports ─────────────────────────────────────────────────────

/** Requires ADMIN role */
export const requireAdmin = requireRole('ADMIN');

/** Requires MANAGER or ADMIN role */
export const requireManager = requireRole('MANAGER', 'ADMIN');

/** Requires CLIENT, MANAGER, or ADMIN role (any authenticated user) */
export const requireClient = requireRole('CLIENT', 'MANAGER', 'ADMIN');
