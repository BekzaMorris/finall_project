import { Role } from './enums';
import type { SafeUser } from './user';

// ─── Auth Types ──────────────────────────────────────────────────────────────

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface TokenPayload {
  userId: string;
  email: string;
  role: Role;
  iat: number;
  exp: number;
}

export interface AuthResult {
  user: SafeUser;
  tokens: TokenPair;
}
