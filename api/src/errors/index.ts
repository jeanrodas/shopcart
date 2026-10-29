import { AppError } from './AppError.js';

const STATUS_CODE: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
};

export function codeForStatus(status: number): string {
  return STATUS_CODE[status] ?? `HTTP_${status}`;
}

export class NotFoundError extends AppError {
  constructor(message = 'Recurso no encontrado', details?: unknown) {
    super(404, 'NOT_FOUND', message, details);
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Datos de entrada invalidos', details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'No autenticado', details?: unknown) {
    super(401, 'UNAUTHORIZED', message, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Acceso denegado', details?: unknown) {
    super(403, 'FORBIDDEN', message, details);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflicto con el estado actual del recurso', details?: unknown) {
    super(409, 'CONFLICT', message, details);
  }
}

/**
 * Traduce un error de mssql a un AppError segun su numero (err.number).
 * El status se codifica en el numero del THROW porque el state de
 * RAISERROR/THROW es un TINYINT (0-255) y no alcanza para un codigo HTTP.
 */
export function mapSqlError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  const candidate = err as { number?: number; message?: string };
  const num = candidate?.number;
  const message =
    typeof candidate?.message === 'string' && candidate.message.length > 0
      ? candidate.message
      : 'Error de base de datos';

  // Clave duplicada (unique / primary key)
  if (num === 2627 || num === 2601) {
    return new ConflictError('Registro duplicado');
  }

  // Violacion de FK o CHECK
  if (num === 547) {
    return new ConflictError('Violacion de integridad referencial o de restriccion');
  }

  // THROW 50400-50499 -> status = numero - 50000 (50404 -> 404, 50409 -> 409, 50422 -> 422)
  if (typeof num === 'number' && num >= 50400 && num <= 50499) {
    const status = num - 50000;
    return new AppError(status, codeForStatus(status), message);
  }

  // Cualquier otro THROW de negocio (50000-50999) -> 400 con el mensaje del THROW
  if (typeof num === 'number' && num >= 50000 && num <= 50999) {
    return new AppError(400, codeForStatus(400), message);
  }

  // Cualquier otro error: no exponer detalles internos
  return new AppError(500, 'INTERNAL_ERROR', 'Error interno del servidor');
}

export { AppError };
