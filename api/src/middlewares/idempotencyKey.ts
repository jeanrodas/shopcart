import type { RequestHandler } from 'express';
import { AppError } from '../errors/index.js';
import { idempotencyKeySchema } from '../schemas/checkout.schema.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      idempotencyKey?: string;
    }
  }
}

/**
 * Exige el header Idempotency-Key en el pago. Ausente o con formato invalido ->
 * 400 con code 'IDEMPOTENCY_KEY_REQUIRED' (formato de error estandar via
 * errorHandler). Si es valido lo adjunta como req.idempotencyKey.
 */
export const idempotencyKey: RequestHandler = (req, _res, next) => {
  const parsed = idempotencyKeySchema.safeParse(req.header('idempotency-key'));
  if (!parsed.success) {
    next(
      new AppError(
        400,
        'IDEMPOTENCY_KEY_REQUIRED',
        'El header Idempotency-Key es obligatorio (16 a 100 caracteres: letras, numeros, guion o guion bajo)',
      ),
    );
    return;
  }
  req.idempotencyKey = parsed.data;
  next();
};
