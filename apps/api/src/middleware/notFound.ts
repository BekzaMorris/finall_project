import type { Request, Response } from 'express';

/**
 * 404 handler for unmatched routes.
 * Must be registered after all route handlers.
 */
export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${_req.method} ${_req.originalUrl} not found`,
  });
}
