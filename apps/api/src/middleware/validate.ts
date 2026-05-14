import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';

/**
 * Middleware factory that validates req.body against a Zod schema.
 * Uses strict parsing to reject unknown fields.
 * On success, replaces req.body with the parsed (stripped) result.
 * On failure, throws ZodError which the global errorHandler converts to 400.
 */
export function validateBody(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.parse(req.body);
    req.body = result;
    next();
  };
}

/**
 * Middleware factory that validates req.query against a Zod schema.
 * Query parameters arrive as strings, so schemas should use coercion
 * (e.g., z.coerce.number()) to convert string values to proper types.
 * On success, stores the parsed result on res.locals.query (since req.query
 * is read-only in Express 5) and also overrides the req.query getter.
 * On failure, throws ZodError which the global errorHandler converts to 400.
 */
export function validateQuery(schema: ZodSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.parse(req.query);
    // In Express 5, req.query is a read-only getter. Store parsed result
    // on res.locals.query and override the getter on this specific request instance.
    res.locals.query = result;
    Object.defineProperty(req, 'query', {
      value: result,
      writable: true,
      configurable: true,
    });
    next();
  };
}

/**
 * Middleware factory that validates req.params against a Zod schema.
 * On success, replaces req.params with the parsed result.
 * On failure, throws ZodError which the global errorHandler converts to 400.
 */
export function validateParams(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.parse(req.params);
    req.params = result as Record<string, string>;
    next();
  };
}
