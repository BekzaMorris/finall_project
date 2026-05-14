import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { redis } from '../lib/redis.js';
import { env } from '../config/env.js';
import { AuthenticationError, ConflictError } from '../utils/errors.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  company?: string;
  phone?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface SafeUser {
  id: string;
  email: string;
  name: string;
  company: string | null;
  phone: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResult {
  user: SafeUser;
  tokens: TokenPair;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = '15m';
const ACCESS_TOKEN_EXPIRY_SECONDS = 900; // 15 minutes
const REFRESH_TOKEN_TTL = 7 * 24 * 3600; // 7 days in seconds

/**
 * Dummy bcrypt hash used for timing-safe comparison when user is not found.
 * This ensures login attempts for non-existent emails take the same time
 * as attempts for existing emails, preventing timing-based user enumeration.
 */
const DUMMY_HASH = '$2b$12$LJ3m4sMKfRzlTEhTyOR.YOdlBe/JMgNIl0GjpKXg5G1dWECvsDKmG';

// ─── Helper Functions ────────────────────────────────────────────────────────

function excludePassword(user: {
  id: string;
  email: string;
  password: string;
  name: string;
  company: string | null;
  phone: string | null;
  role: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): SafeUser {
  const { password: _, ...safeUser } = user;
  return safeUser;
}

function generateAccessToken(payload: {
  userId: string;
  email: string;
  role: string;
}): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });
}

function generateRefreshToken(): string {
  return crypto.randomUUID();
}

async function storeRefreshToken(
  token: string,
  userId: string,
): Promise<void> {
  await redis.setex(`refresh:${token}`, REFRESH_TOKEN_TTL, userId);
}

// ─── Auth Service ────────────────────────────────────────────────────────────

/**
 * Register a new user with CLIENT role.
 * Hashes password with bcrypt (12 rounds) and returns tokens.
 */
export async function register(data: RegisterInput): Promise<AuthResult> {
  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    throw new ConflictError('Email is already registered');
  }

  // Hash password with bcrypt (12 rounds)
  const hashedPassword = await bcrypt.hash(data.password, BCRYPT_ROUNDS);

  // Create user with CLIENT role
  const user = await prisma.user.create({
    data: {
      email: data.email,
      password: hashedPassword,
      name: data.name,
      company: data.company ?? null,
      phone: data.phone ?? null,
      role: 'CLIENT',
    },
  });

  // Generate tokens
  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  const refreshToken = generateRefreshToken();
  await storeRefreshToken(refreshToken, user.id);

  return {
    user: excludePassword(user),
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
    },
  };
}

/**
 * Authenticate a user with email and password.
 * Uses constant-time comparison to prevent timing attacks.
 * Returns generic "Invalid credentials" on failure (never reveals if email exists).
 */
export async function login(
  email: string,
  password: string,
): Promise<AuthResult> {
  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
  });

  // Always perform bcrypt.compare even when user is not found (timing attack prevention).
  // bcrypt.compare is inherently constant-time for the hash comparison step.
  const hashToCompare = user?.password ?? DUMMY_HASH;
  const isValid = await bcrypt.compare(password, hashToCompare);

  if (!user || !isValid) {
    throw new AuthenticationError('Invalid credentials');
  }

  // Check if account is active
  if (!user.isActive) {
    throw new AuthenticationError('Invalid credentials');
  }

  // Generate tokens
  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  const refreshToken = generateRefreshToken();
  await storeRefreshToken(refreshToken, user.id);

  // Update last login timestamp
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    user: excludePassword(user),
    tokens: {
      accessToken,
      refreshToken,
      expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
    },
  };
}

/**
 * Refresh an access token using a valid refresh token.
 * Implements token rotation: old token is invalidated immediately,
 * a new refresh token is issued.
 */
export async function refreshToken(token: string): Promise<TokenPair> {
  // Validate refresh token exists in Redis
  const userId = await redis.get(`refresh:${token}`);

  if (!userId) {
    throw new AuthenticationError('Invalid or expired refresh token');
  }

  // Immediately invalidate the old refresh token (rotation)
  await redis.del(`refresh:${token}`);

  // Look up user to get current role/email for new access token
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user || !user.isActive) {
    throw new AuthenticationError('Invalid or expired refresh token');
  }

  // Generate new token pair
  const accessToken = generateAccessToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  const newRefreshToken = generateRefreshToken();
  await storeRefreshToken(newRefreshToken, user.id);

  return {
    accessToken,
    refreshToken: newRefreshToken,
    expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS,
  };
}

/**
 * Logout by revoking the refresh token from Redis.
 */
export async function logout(token: string): Promise<void> {
  await redis.del(`refresh:${token}`);
}

/**
 * Get the current user by ID (without password hash).
 */
export async function getCurrentUser(userId: string): Promise<SafeUser | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    return null;
  }

  return excludePassword(user);
}

/**
 * Verify an access token and return its payload.
 */
export function verifyAccessToken(token: string): TokenPayload | null {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
    return payload;
  } catch {
    return null;
  }
}
