import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import * as authService from '../services/auth.service.js';
import { validateBody } from '../middleware/validate.js';
import { loginRateLimiter, incrementLoginAttempts, clearLoginAttempts } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';
import { env } from '../config/env.js';

// ─── Zod Validation Schemas ─────────────────────────────────────────────────

const registerSchema = z.object({
  email: z
    .string()
    .email('Invalid email format')
    .max(255, 'Email must be at most 255 characters'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/\d/, 'Password must contain at least one digit'),
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters'),
  company: z.string().optional(),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

// ─── Cookie Configuration ────────────────────────────────────────────────────

const REFRESH_TOKEN_COOKIE = 'refreshToken';
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

function setRefreshTokenCookie(res: Response, token: string): void {
  res.cookie(REFRESH_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth',
  });
}

// ─── Router ──────────────────────────────────────────────────────────────────

const router = Router();

/**
 * POST /api/auth/register
 * Register a new user account.
 */
router.post(
  '/register',
  validateBody(registerSchema),
  async (req: Request, res: Response): Promise<void> => {
    const result = await authService.register(req.body);
    setRefreshTokenCookie(res, result.tokens.refreshToken);
    res.status(201).json({
      user: result.user,
      tokens: result.tokens,
    });
  },
);

/**
 * POST /api/auth/login
 * Authenticate with email and password.
 */
router.post(
  '/login',
  loginRateLimiter,
  validateBody(loginSchema),
  async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;
    try {
      const result = await authService.login(email, password);
      await clearLoginAttempts(email);
      setRefreshTokenCookie(res, result.tokens.refreshToken);
      res.status(200).json({
        user: result.user,
        tokens: result.tokens,
      });
    } catch (error) {
      await incrementLoginAttempts(email);
      throw error;
    }
  },
);

/**
 * POST /api/auth/refresh
 * Refresh the access token using the refresh token from httpOnly cookie.
 */
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.[REFRESH_TOKEN_COOKIE];

  if (!token) {
    res.status(401).json({ error: 'Refresh token not found' });
    return;
  }

  const tokens = await authService.refreshToken(token);
  setRefreshTokenCookie(res, tokens.refreshToken);
  res.status(200).json({ tokens });
});

/**
 * POST /api/auth/logout
 * Revoke the refresh token and clear the cookie.
 */
router.post('/logout', async (req: Request, res: Response): Promise<void> => {
  const token = req.cookies?.[REFRESH_TOKEN_COOKIE];

  if (token) {
    await authService.logout(token);
  }

  clearRefreshTokenCookie(res);
  res.status(200).json({ message: 'Logged out' });
});

/**
 * GET /api/auth/me
 * Get the current authenticated user's profile.
 */
router.get(
  '/me',
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const user = await authService.getCurrentUser(req.user!.userId);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json(user);
  },
);

export { router as authRouter };
