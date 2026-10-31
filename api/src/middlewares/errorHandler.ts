import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../errors/index.js';
import { env } from '../config/env.js';

interface ErrorBody {
  code: string;
  message: string;
  details?: unknown;
  requestId: string;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const requestId = req.requestId ?? 'desconocido';

  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    }));
    const body: ErrorBody = {
      code: 'VALIDATION_ERROR',
      message: 'Datos de entrada invalidos',
      details,
      requestId,
    };
    res.status(400).json(body);
    return;
  }

  if (err instanceof AppError) {
    const body: ErrorBody = { code: err.code, message: err.message, requestId };
    if (err.details !== undefined) {
      body.details = err.details;
    }
    res.status(err.statusCode).json(body);
    return;
  }

  // Error desconocido: log completo en servidor, respuesta generica al cliente.
  console.error(`[error] requestId=${requestId}`, err);

  const body: ErrorBody = {
    code: 'INTERNAL_ERROR',
    message: 'Error interno del servidor',
    requestId,
  };
  if (env.NODE_ENV === 'development') {
    body.details = err instanceof Error ? err.message : String(err);
  }
  res.status(500).json(body);
};
