import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { ZodError, z } from 'zod';
import { errorHandler } from './errorHandler.js';
import {
  AppError,
  NotFoundError,
  AuthenticationError,
  ForbiddenError,
  ConflictError,
  ValidationError,
  RateLimitError,
} from '../utils/errors.js';

function createTestApp(errorToThrow: Error) {
  const app = express();
  app.get('/test', () => {
    throw errorToThrow;
  });
  app.use(errorHandler);
  return app;
}

describe('Error Handler Middleware', () => {
  it('returns 500 with referenceId for unknown errors, no stack trace', async () => {
    const app = createTestApp(new Error('Something broke'));
    const res = await request(app).get('/test');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal Server Error');
    expect(res.body.referenceId).toBeDefined();
    expect(res.body.referenceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    // Must NOT expose stack traces
    expect(res.body.stack).toBeUndefined();
    expect(res.body.message).toBeUndefined();
  });

  it('handles NotFoundError → 404', async () => {
    const app = createTestApp(new NotFoundError('Product not found'));
    const res = await request(app).get('/test');

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Product not found');
    expect(res.body.referenceId).toBeDefined();
  });

  it('handles AuthenticationError → 401', async () => {
    const app = createTestApp(new AuthenticationError());
    const res = await request(app).get('/test');

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid credentials');
    expect(res.body.referenceId).toBeDefined();
  });

  it('handles ForbiddenError → 403', async () => {
    const app = createTestApp(new ForbiddenError());
    const res = await request(app).get('/test');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.referenceId).toBeDefined();
  });

  it('handles ConflictError → 409', async () => {
    const app = createTestApp(new ConflictError('Resource already exists'));
    const res = await request(app).get('/test');

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('Resource already exists');
    expect(res.body.referenceId).toBeDefined();
  });

  it('handles ValidationError → 400 with fields', async () => {
    const app = createTestApp(
      new ValidationError('Invalid input', { email: 'Invalid email format' }),
    );
    const res = await request(app).get('/test');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid input');
    expect(res.body.fields).toEqual({ email: 'Invalid email format' });
    expect(res.body.referenceId).toBeDefined();
  });

  it('handles RateLimitError → 429 with Retry-After header', async () => {
    const app = createTestApp(new RateLimitError('Too many requests', 120));
    const res = await request(app).get('/test');

    expect(res.status).toBe(429);
    expect(res.body.error).toBe('Too many requests');
    expect(res.headers['retry-after']).toBe('120');
    expect(res.body.referenceId).toBeDefined();
  });

  it('handles Zod validation errors → 400 with field details', async () => {
    const schema = z.object({
      email: z.string().email(),
      age: z.number().min(18),
    });

    let zodError: ZodError;
    try {
      schema.parse({ email: 'invalid', age: 5 });
    } catch (e) {
      zodError = e as ZodError;
    }

    const app = createTestApp(zodError!);
    const res = await request(app).get('/test');

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
    expect(res.body.referenceId).toBeDefined();
    expect(res.body.fields).toBeDefined();
    expect(res.body.fields.email).toBeDefined();
    expect(res.body.fields.age).toBeDefined();
  });

  it('never exposes stack traces for AppError subclasses', async () => {
    const app = createTestApp(new AppError('Custom error', 422));
    const res = await request(app).get('/test');

    expect(res.status).toBe(422);
    expect(res.body.stack).toBeUndefined();
  });
});
