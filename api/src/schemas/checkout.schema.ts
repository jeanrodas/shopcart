import { z } from 'zod';

/** Cuerpo de POST /checkout/iniciar: direccion de entrega del cliente. */
export const iniciarSchema = z.object({
  idDireccion: z.coerce.number().int().positive(),
});

/** Cuerpo de POST /checkout/pagar: direccion, metodo y resultado simulado. */
export const pagarSchema = z.object({
  idDireccion: z.coerce.number().int().positive(),
  metodoPago: z.enum(['TARJETA', 'TRANSFERENCIA', 'EFECTIVO']),
  simularResultado: z.enum(['APROBADO', 'RECHAZADO']).default('APROBADO'),
});

/** Clave de idempotencia (header Idempotency-Key): 16-100 caracteres [A-Za-z0-9_-]. */
export const idempotencyKeySchema = z
  .string()
  .trim()
  .min(16)
  .max(100)
  .regex(/^[A-Za-z0-9_-]+$/, 'solo letras, numeros, guion y guion bajo');

export type IniciarInput = z.infer<typeof iniciarSchema>;
export type PagarInput = z.infer<typeof pagarSchema>;
