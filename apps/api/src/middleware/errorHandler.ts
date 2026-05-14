import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { AppError, RateLimitError, StatusTransitionError, ValidationError } from '../utils/errors.js';

/**
 * Checks if an error is a Zod validation error (ZodError).
 * We check by name to avoid importing zod directly in this module.
 */
function isZodError(err: unknown): err is { name: 'ZodError'; issues: Array<{ path: (string | number)[]; message: string }> } {
  return (
    err instanceof Error &&
    err.name === 'ZodError' &&
    'issues' in err &&
    Array.isArray((err as Record<string, unknown>).issues)
  );
}

/**
 * Global error handler middleware.
 * - Generates a unique error reference ID for each error
 * - Logs full error details (stack trace) server-side
 * - Returns sanitized error response to client (no stack traces)
 * - Handles Zod validation errors → 400
 * - Handles known AppError subclasses with appropriate status codes
 */
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const referenceId = randomUUID();

  // Log full error details server-side for debugging / Sentry
  console.error(`[${referenceId}]`, {
    name: err.name,
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString(),
  });

  // Handle Zod validation errors → 400
  if (isZodError(err)) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const path = issue.path.join('.');
      fields[path || '_root'] = issue.message;
    }

    res.status(400).json({
      error: 'Validation Error',
      referenceId,
      fields,
    });
    return;
  }

  // Handle known operational errors (AppError subclasses)
  if (err instanceof AppError) {
    const body: Record<string, unknown> = {
      error: err.message,
      referenceId,
    };

    if (err instanceof ValidationError && err.fields) {
      body.fields = err.fields;
    }

    if (err instanceof StatusTransitionError) {
      body.currentStatus = err.currentStatus;
      body.allowedTransitions = err.allowedTransitions;
    }

    if (err instanceof RateLimitError) {
      res.setHeader('Retry-After', String(err.retryAfter));
    }

    res.status(err.statusCode).json(body);
    return;
  }

  // Unhandled / unexpected errors — never expose internals
  res.status(500).json({
    error: 'Internal Server Error',
    referenceId,
  });
}
