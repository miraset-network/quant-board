import { Request, Response, NextFunction } from 'express'

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  console.error('API Error:', error)
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: error.message,
  })
}

export function notFound(
  req: Request,
  res: Response
): void {
  res.status(404).json({
    error: 'NOT_FOUND',
    message: `Route ${req.path} not found`,
  })
}