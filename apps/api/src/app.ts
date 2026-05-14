import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { requestId } from './middleware/requestId.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFoundHandler } from './middleware/notFound.js';
import { authRouter } from './routes/auth.routes.js';
import { ticketRouter } from './routes/ticket.routes.js';
import { adminTicketRouter } from './routes/admin/ticket.routes.js';
import { adminProductRouter } from './routes/admin/product.routes.js';
import { adminOrderRouter } from './routes/admin/order.routes.js';
import { adminUserRouter } from './routes/admin/user.routes.js';
import { uploadRouter } from './routes/upload.routes.js';
import { configuratorRouter } from './routes/configurator.routes.js';
import { productRouter } from './routes/product.routes.js';
import { favoriteRouter } from './routes/favorite.routes.js';
import { cartRouter } from './routes/cart.routes.js';
import { orderRouter } from './routes/order.routes.js';

/**
 * Creates and configures the Express application.
 * Exported as a factory function for testability.
 */
export function createApp(): Express {
  const app = express();

  // --- Middleware stack (order matters) ---

  // 1. Security headers (CSP, HSTS, X-Frame-Options, etc.)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
      hsts: { maxAge: 31536000, includeSubDomains: true },
    }),
  );

  // 2. CORS (configurable origin from env, credentials: true)
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );

  // 3. JSON body parser (limit: 10mb)
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // 4. Cookie parser
  app.use(cookieParser());

  // 5. Request ID (generates UUID for each request)
  app.use(requestId);

  // 6. Request logger (method, path, status, duration)
  app.use(requestLogger);

  // --- Routes ---

  // Health check endpoint — verifies DB and Redis connectivity
  app.get('/api/health', async (_req, res) => {
    const checks: Record<string, { status: string; latencyMs?: number }> = {};

    // Check PostgreSQL
    const dbStart = Date.now();
    try {
      const { prisma } = await import('./lib/prisma.js');
      await prisma.$queryRawUnsafe('SELECT 1');
      checks.database = { status: 'ok', latencyMs: Date.now() - dbStart };
    } catch {
      checks.database = { status: 'error', latencyMs: Date.now() - dbStart };
    }

    // Check Redis
    const redisStart = Date.now();
    try {
      const { isRedisAvailable } = await import('./lib/redis.js');
      const available = await isRedisAvailable();
      checks.redis = {
        status: available ? 'ok' : 'error',
        latencyMs: Date.now() - redisStart,
      };
    } catch {
      checks.redis = { status: 'error', latencyMs: Date.now() - redisStart };
    }

    const overallStatus = Object.values(checks).every((c) => c.status === 'ok')
      ? 'ok'
      : 'degraded';

    const statusCode = overallStatus === 'ok' ? 200 : 503;

    res.status(statusCode).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks,
    });
  });

  // Auth routes
  app.use('/api/auth', authRouter);

  // Ticket routes
  app.use('/api/tickets', ticketRouter);

  // Admin ticket routes
  app.use('/api/admin/tickets', adminTicketRouter);

  // Admin product routes
  app.use('/api/admin/products', adminProductRouter);

  // Upload routes
  app.use('/api/uploads', uploadRouter);

  // Configurator routes
  app.use('/api/configurator', configuratorRouter);

  // Product routes
  app.use('/api/products', productRouter);

  // Cart routes
  app.use('/api/cart', cartRouter);

  // Order routes
  app.use('/api/orders', orderRouter);

  // Admin order routes
  app.use('/api/admin/orders', adminOrderRouter);

  // Admin user routes
  app.use('/api/admin/users', adminUserRouter);

  // Favorites routes
  app.use('/api/favorites', favoriteRouter);

  // 404 handler for unmatched routes (must be after all route registrations)
  app.use(notFoundHandler);

  // Global error handler (must be last middleware)
  app.use(errorHandler);

  return app;
}

// Default export for backward compatibility
const app = createApp();
export default app;
