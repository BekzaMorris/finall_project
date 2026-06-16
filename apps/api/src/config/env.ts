import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// src/config/env.ts -> apps/api/.env
const envPath = path.resolve(__dirname, '../../.env');

dotenv.config({ path: envPath });

/**
 * Environment configuration.
 * Loads and validates required environment variables.
 * Uses dotenv for local development.
 */
export const env = {
  // Server
  PORT: parseInt(process.env.PORT || '4000', 10),
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Database
  DATABASE_URL: process.env.DATABASE_URL || '',

  // Redis
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',

  // JWT
  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',

  // S3 / MinIO
  S3_ENDPOINT: process.env.S3_ENDPOINT || 'http://localhost:9000',
  S3_ACCESS_KEY: process.env.S3_ACCESS_KEY || 'minioadmin',
  S3_SECRET_KEY: process.env.S3_SECRET_KEY || 'minioadmin',
  S3_BUCKET: process.env.S3_BUCKET || 'kiroportal',

  // SMTP
  SMTP_HOST: process.env.SMTP_HOST || 'localhost',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '1025', 10),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || 'noreply@kiroportal.com',

  // Sentry
  SENTRY_DSN: process.env.SENTRY_DSN || '',

  // iTop — variable names must match .env file
  ITOP_ENABLED: process.env.ITOP_ENABLED || 'false',
  ITOP_URL: process.env.ITOP_API_URL || '',
  ITOP_AUTH_TOKEN: process.env.ITOP_AUTH_TOKEN || '',
  ITOP_AUTH_USER: process.env.ITOP_USERNAME || '',
  ITOP_AUTH_PWD: process.env.ITOP_PASSWORD || '',
  ITOP_TICKET_CLASS: process.env.ITOP_TICKET_CLASS || 'UserRequest',
} as const;

/**
 * Validates that critical environment variables are set in production.
 * Logs warnings in development for missing optional vars.
 */
export function validateEnv(): void {
  const required: Array<keyof typeof env> = ['DATABASE_URL'];

  if (env.NODE_ENV === 'production') {
    required.push(
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'CORS_ORIGIN',
      'REDIS_URL',
    );
  }

  const missing = required.filter((key) => !env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`,
    );
  }

  const isItopEnabled = env.ITOP_ENABLED === 'true';

  if (isItopEnabled) {
    // Need either auth_token OR both user+pwd
    const hasToken = !!env.ITOP_AUTH_TOKEN;
    const hasUserPwd = !!env.ITOP_AUTH_USER && !!env.ITOP_AUTH_PWD;

    if (!env.ITOP_URL) {
      throw new Error('iTop integration is enabled but ITOP_API_URL is missing');
    }

    if (!hasToken && !hasUserPwd) {
      throw new Error(
        'iTop integration is enabled but no auth method provided. Set ITOP_AUTH_TOKEN or both ITOP_USERNAME and ITOP_PASSWORD',
      );
    }
  }
}
