import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../utils/apiError';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: err.flatten(),
    });
  }

  if (err?.code === 11000) {
    return res.status(409).json({
      success: false,
      message: 'A unique field already exists',
      code: 'DUPLICATE_KEY',
      details: err.keyValue,
    });
  }

  const error = err instanceof ApiError
    ? err
    : new ApiError(500, 'Internal server error', 'INTERNAL_ERROR');

  if (process.env.NODE_ENV !== 'test') console.error(err);

  return res.status(error.statusCode).json({
    success: false,
    message: error.message,
    code: error.code,
    ...(error.details ? { details: error.details } : {}),
  });
};
