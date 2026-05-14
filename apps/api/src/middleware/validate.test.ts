import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { validateBody, validateQuery, validateParams } from './validate.js';
import { errorHandler } from './errorHandler.js';

function createBodyApp(schema: z.ZodSchema) {
  const app = express();
  app.use(express.json());
  app.post('/test', validateBody(schema), (req, res) => {
    res.json({ data: req.body });
  });
  app.use(errorHandler);
  return app;
}

function createQueryApp(schema: z.ZodSchema) {
  const app = express();
  app.get('/test', validateQuery(schema), (req, res) => {
    res.json({ data: req.query });
  });
  app.use(errorHandler);
  return app;
}

function createParamsApp(schema: z.ZodSchema) {
  const app = express();
  app.get('/test/:slug', validateParams(schema), (req, res) => {
    res.json({ data: req.params });
  });
  app.use(errorHandler);
  return app;
}

describe('Validation Middleware', () => {
  describe('validateBody', () => {
    const schema = z.object({
      name: z.string().min(1),
      price: z.number().positive(),
      email: z.string().email(),
    }).strict();

    it('passes valid body and attaches parsed result to req.body', async () => {
      const app = createBodyApp(schema);
      const res = await request(app)
        .post('/test')
        .send({ name: 'Server X', price: 999.99, email: 'test@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        name: 'Server X',
        price: 999.99,
        email: 'test@example.com',
      });
    });

    it('returns 400 with field-specific errors for invalid body', async () => {
      const app = createBodyApp(schema);
      const res = await request(app)
        .post('/test')
        .send({ name: '', price: -10, email: 'not-an-email' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
      expect(res.body.fields).toBeDefined();
      expect(res.body.fields.name).toBeDefined();
      expect(res.body.fields.price).toBeDefined();
      expect(res.body.fields.email).toBeDefined();
    });

    it('rejects unknown fields in request body when schema is strict', async () => {
      const app = createBodyApp(schema);
      const res = await request(app)
        .post('/test')
        .send({
          name: 'Server X',
          price: 999.99,
          email: 'test@example.com',
          unknownField: 'should be rejected',
          anotherExtra: 42,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
      expect(res.body.fields).toBeDefined();
    });
  });

  describe('validateQuery', () => {
    const schema = z.object({
      page: z.coerce.number().int().positive().optional(),
      limit: z.coerce.number().int().min(1).max(100).optional(),
      active: z.coerce.boolean().optional(),
    });

    it('validates and coerces query string values to proper types', async () => {
      const app = createQueryApp(schema);
      const res = await request(app)
        .get('/test?page=2&limit=50&active=true');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        page: 2,
        limit: 50,
        active: true,
      });
    });

    it('returns 400 for invalid query parameters', async () => {
      const schema = z.object({
        page: z.coerce.number().int().positive(),
      }).strict();
      const app = createQueryApp(schema);
      const res = await request(app)
        .get('/test?page=abc');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
    });
  });

  describe('validateParams', () => {
    const schema = z.object({
      slug: z.string().regex(/^[a-z0-9-]+$/, 'Slug must be URL-safe'),
    });

    it('passes valid params', async () => {
      const app = createParamsApp(schema);
      const res = await request(app).get('/test/my-server-123');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ slug: 'my-server-123' });
    });

    it('returns 400 for invalid params', async () => {
      const app = createParamsApp(schema);
      const res = await request(app).get('/test/INVALID_SLUG!');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation Error');
      expect(res.body.fields).toBeDefined();
      expect(res.body.fields.slug).toBeDefined();
    });
  });
});
