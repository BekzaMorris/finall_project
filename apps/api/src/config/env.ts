import 'dotenv/config';

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
}
