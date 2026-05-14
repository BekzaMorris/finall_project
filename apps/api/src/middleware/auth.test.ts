import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { requireAuth, requireRole, requireAdmin, requireManager, requireClient } from './auth.js';
import { errorHandler } from './errorHandler.js';
import { env } from '../config/env.js';

// ─── Test Helpers ────────────────────────────────────────────────────────────

function createToken(payload: { userId: string; email: string; role: string }, options?: jwt.SignOptions): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: '15m', ...options });
}

function createApp(...middlewares: express.RequestHandler[]) {
  const app = express();
  app.get('/test', ...middlewares, (req, res) => {
    res.json({ success: true, user: (req as any).user });
  });
  app.use(errorHandler);
  return app;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('requireAuth middleware', () => {
  it('passes and attaches user to request when valid JWT is provided', async () => {
    const token = createToken({ userId: 'user-1', email: 'test@example.com', role: 'CLIENT' });
    const app = createApp(requireAuth);

    const res = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user).toMatchObject({
      userId: 'user-1',
      email: 'test@example.com',
      role: 'CLIENT',
    });
  });

  it('returns 401 when Authorization header is missing', async () => {
    const app = createApp(requireAuth);

    const res = await request(app).get('/test');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication required');
  });

  it('returns 401 when Authorization header does not start with Bearer', async () => {
    const app = createApp(requireAuth);

    const res = await request(app)
      .get('/test')
      .set('Authorization', 'Basic abc123');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication required');
  });

  it('returns 401 when token is empty after Bearer prefix', async () => {
    const app = createApp(requireAuth);

    const res = await request(app)
      .get('/test')
      .set('Authorization', 'Bearer ');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication required');
  });

  it('returns 401 when JWT is invalid (malformed)', async () => {
    const app = createApp(requireAuth);

    const res = await request(app)
      .get('/test')
      .set('Authorization', 'Bearer invalid.token.here');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid or expired token');
  });

  it('returns 401 when JWT is expired', async () => {
    const token = createToken(
      { userId: 'user-1', email: 'test@example.com', role: 'CLIENT' },
      { expiresIn: '0s' },
    );
    const app = createApp(requireAuth);

    // Small delay to ensure token is expired
    await new Promise((resolve) => setTimeout(resolve, 10));

    const res = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid or expired token');
  });

  it('returns 401 when JWT is signed with wrong secret', async () => {
    const token = jwt.sign(
      { userId: 'user-1', email: 'test@example.com', role: 'CLIENT' },
      'wrong-secret',
      { expiresIn: '15m' },
    );
    const app = createApp(requireAuth);

    const res = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid or expired token');
  });
});

describe('requireRole middleware', () => {
  it('allows ADMIN to access admin-only endpoint', async () => {
    const token = createToken({ userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' });
    const app = createApp(requireAuth, requireAdmin);

    const res = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 403 when MANAGER accesses admin-only endpoint', async () => {
    const token = createToken({ userId: 'mgr-1', email: 'manager@example.com', role: 'MANAGER' });
    const app = createApp(requireAuth, requireAdmin);

    const res = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Insufficient permissions');
  });

  it('returns 403 when CLIENT accesses admin-only endpoint', async () => {
    const token = createToken({ userId: 'client-1', email: 'client@example.com', role: 'CLIENT' });
    const app = createApp(requireAuth, requireAdmin);

    const res = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Insufficient permissions');
  });

  it('allows ADMIN to access manager endpoint (hierarchy)', async () => {
    const token = createToken({ userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' });
    const app = createApp(requireAuth, requireManager);

    const res = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('allows MANAGER to access manager endpoint', async () => {
    const token = createToken({ userId: 'mgr-1', email: 'manager@example.com', role: 'MANAGER' });
    const app = createApp(requireAuth, requireManager);

    const res = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 403 when CLIENT accesses manager endpoint', async () => {
    const token = createToken({ userId: 'client-1', email: 'client@example.com', role: 'CLIENT' });
    const app = createApp(requireAuth, requireManager);

    const res = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Insufficient permissions');
  });

  it('allows all authenticated roles to access client endpoint', async () => {
    const app = createApp(requireAuth, requireClient);

    for (const role of ['CLIENT', 'MANAGER', 'ADMIN']) {
      const token = createToken({ userId: `user-${role}`, email: `${role.toLowerCase()}@example.com`, role });
      const res = await request(app)
        .get('/test')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    }
  });

  it('enforces role checks before route handler execution', async () => {
    const handlerSpy = vi.fn((_req, res) => res.json({ reached: true }));
    const app = express();
    app.get('/test', requireAuth, requireAdmin, handlerSpy as any);
    app.use(errorHandler);

    const token = createToken({ userId: 'client-1', email: 'client@example.com', role: 'CLIENT' });
    const res = await request(app)
      .get('/test')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
    expect(handlerSpy).not.toHaveBeenCalled();
  });

  it('returns 401 when requireRole is used without prior authentication', async () => {
    // Simulate calling requireRole without requireAuth (no req.user)
    const app = express();
    app.get('/test', requireAdmin, (_req, res) => res.json({ success: true }));
    app.use(errorHandler);

    const res = await request(app).get('/test');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Authentication required');
  });
});

describe('Role hierarchy enforcement', () => {
  it('ADMIN has access to all role levels', async () => {
    const token = createToken({ userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' });

    // Admin-only
    let app = createApp(requireAuth, requireAdmin);
    let res = await request(app).get('/test').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    // Manager-level
    app = createApp(requireAuth, requireManager);
    res = await request(app).get('/test').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    // Client-level
    app = createApp(requireAuth, requireClient);
    res = await request(app).get('/test').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('MANAGER has access to manager and client levels but not admin', async () => {
    const token = createToken({ userId: 'mgr-1', email: 'manager@example.com', role: 'MANAGER' });

    // Admin-only → 403
    let app = createApp(requireAuth, requireAdmin);
    let res = await request(app).get('/test').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);

    // Manager-level → 200
    app = createApp(requireAuth, requireManager);
    res = await request(app).get('/test').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    // Client-level → 200
    app = createApp(requireAuth, requireClient);
    res = await request(app).get('/test').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('CLIENT has access to client level only', async () => {
    const token = createToken({ userId: 'client-1', email: 'client@example.com', role: 'CLIENT' });

    // Admin-only → 403
    let app = createApp(requireAuth, requireAdmin);
    let res = await request(app).get('/test').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);

    // Manager-level → 403
    app = createApp(requireAuth, requireManager);
    res = await request(app).get('/test').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);

    // Client-level → 200
    app = createApp(requireAuth, requireClient);
    res = await request(app).get('/test').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('custom role combination works correctly', async () => {
    // requireRole('MANAGER', 'ADMIN') should allow both MANAGER and ADMIN
    const customMiddleware = requireRole('MANAGER', 'ADMIN');

    const adminToken = createToken({ userId: 'admin-1', email: 'admin@example.com', role: 'ADMIN' });
    const mgrToken = createToken({ userId: 'mgr-1', email: 'manager@example.com', role: 'MANAGER' });
    const clientToken = createToken({ userId: 'client-1', email: 'client@example.com', role: 'CLIENT' });

    const app = createApp(requireAuth, customMiddleware);

    let res = await request(app).get('/test').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    res = await request(app).get('/test').set('Authorization', `Bearer ${mgrToken}`);
    expect(res.status).toBe(200);

    res = await request(app).get('/test').set('Authorization', `Bearer ${clientToken}`);
    expect(res.status).toBe(403);
  });
});
