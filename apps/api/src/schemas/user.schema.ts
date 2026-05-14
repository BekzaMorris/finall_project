import { z } from 'zod';

// ─── Role Enum ───────────────────────────────────────────────────────────────

const roleEnum = z.enum(['CLIENT', 'MANAGER', 'ADMIN']);

// ─── Update User Role Schema ─────────────────────────────────────────────────

export const updateUserRoleSchema = z.object({
  role: roleEnum,
}).strict();

// ─── Deactivate User Schema ──────────────────────────────────────────────────

export const deactivateUserSchema = z.object({
  isActive: z.boolean(),
}).strict();

// ─── User Email Schema (for validation reuse) ────────────────────────────────

export const emailSchema = z
  .string()
  .email('Invalid email format')
  .max(255, 'Email must be at most 255 characters');

// ─── User Password Schema (for validation reuse) ─────────────────────────────

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/\d/, 'Password must contain at least one digit');

// ─── Exports ─────────────────────────────────────────────────────────────────

export { roleEnum };
