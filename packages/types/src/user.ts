import { Role } from './enums';

// ─── User Types ──────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  company?: string;
  phone?: string;
  role: Role;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/** Safe user type without password hash, used in API responses */
export type SafeUser = Omit<User, 'passwordHash'>;
