import { Request, Response, NextFunction } from 'express';

export function notFound(req: Request, res: Response): void {
  res.status(404).json({ error: `${req.method} ${req.originalUrl} not found` });
}

export function errorHandler(
  err: Error & { status?: number },
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  console.error(err);
  const status = err.status ?? 500;
  res.status(status).json({
    error: status === 500 ? 'Internal server error' : err.message,
  });
}
