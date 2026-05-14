import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

/**
 * Middleware that generates a unique request ID (UUID) for each incoming request.
 * The ID is attached to the request object and set as a response header.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string) || randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
}
