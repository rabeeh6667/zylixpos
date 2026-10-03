import { Request, Response, NextFunction } from 'express';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('[Global Error]', err);

  const statusCode = err.statusCode || err.status || 500;
  const code = err.code || (statusCode === 404 ? 'RESOURCE_NOT_FOUND' : statusCode === 401 ? 'UNAUTHORIZED' : statusCode === 403 ? 'FORBIDDEN' : statusCode === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_SERVER_ERROR');
  const message = err.message ? String(err.message).replace(/SQLite3/g, 'Database') : 'An unexpected internal server error occurred.';

  // Never expose raw stack traces in production responses
  res.status(statusCode).json({
    success: false,
    message,
    code,
  });
}
