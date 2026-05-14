import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';

const app = createApp();

describe('Express App', () => {
  describe('Health check', () => {
    it('GET /api/health returns status with checks', async () => {
      const res = await request(app).get('/api/health');
      // Status is 200 (ok) or 503 (degraded) depending on DB/Redis availability
      expect([200, 503]).toContain(res.status);
      expect(['ok', 'degraded']).toContain(res.body.status);
      expect(res.body.timestamp).toBeDefined();
      expect(res.body.uptime).toBeDefined();
      expect(res.body.checks).toBeDefined();
      expect(res.body.checks.database).toBeDefined();
      expect(res.body.checks.redis).toBeDefined();
    });
  });

  describe('Security headers', () => {
    it('sets Helmet security headers', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    });
  });

  describe('Request ID middleware', () => {
    it('generates X-Request-Id header on response', async () => {
      const res = await request(app).get('/api/health');
      expect(res.headers['x-request-id']).toBeDefined();
      expect(res.headers['x-request-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
    });

    it('uses provided X-Request-Id header if present', async () => {
      const customId = 'custom-request-id-123';
      const res = await request(app)
        .get('/api/health')
        .set('X-Request-Id', customId);
      expect(res.headers['x-request-id']).toBe(customId);
    });
  });

  describe('CORS', () => {
    it('includes CORS headers for allowed origin', async () => {
      const res = await request(app)
        .get('/api/health')
        .set('Origin', 'http://localhost:3000');
      expect(res.headers['access-control-allow-origin']).toBe(
        'http://localhost:3000',
      );
      expect(res.headers['access-control-allow-credentials']).toBe('true');
    });
  });

  describe('JSON body parsing', () => {
    it('parses JSON request bodies', async () => {
      // Use a route that echoes back the body (health doesn't, but we can test via error handler)
      const res = await request(app)
        .post('/api/nonexistent')
        .send({ test: 'value' })
        .set('Content-Type', 'application/json');
      // Should get 404 from notFoundHandler, not a parse error
      expect(res.status).toBe(404);
    });
  });

  describe('404 handler', () => {
    it('returns 404 for unmatched routes', async () => {
      const res = await request(app).get('/api/nonexistent');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });
  });
});
