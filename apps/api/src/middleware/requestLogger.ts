import type { Request, Response, NextFunction } from 'express';

/**
 * Request logger middleware.
 * Logs method, path, status code, and response duration for each request.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { method, originalUrl } = req;
    const { statusCode } = res;

    console.log(
      `[${new Date().toISOString()}] ${method} ${originalUrl} ${statusCode} ${duration}ms`,
    );
  });

  next();
}
