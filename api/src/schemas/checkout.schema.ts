import { z } from 'zod';
import { textoPlano } from './common.schema.js';

/** Cuerpo de POST /checkout/iniciar: direccion de entrega del cliente. */
export const iniciarSchema = z.object({
  idDireccion: z.coerce.number().int().positive(),
});

/**
 * NIT para la factura: N'CF' (consumidor final) o el formato guatemalteco
 * (hasta 9 digitos, guion opcional y digito verificador 0-9 o K). Se normaliza a
 * mayusculas. Validacion de formato unicamente: no hay consulta en linea a la SAT.
 */
const nitFactura = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^(CF|\d{1,9}-?[\dK])$/, 'NIT invalido (ej. 1234567-8 o CF)');

/** Cuerpo de POST /checkout/pagar: direccion, metodo, resultado simulado y factura. */
export const pagarSchema = z
  .object({
    idDireccion: z.coerce.number().int().positive(),
    metodoPago: z.enum(['TARJETA', 'TRANSFERENCIA', 'EFECTIVO']),
    simularResultado: z.enum(['APROBADO', 'RECHAZADO']).default('APROBADO'),
    nombreFactura: textoPlano(150, 2).optional(),
    nitFactura: nitFactura.optional(),
  })
  // Con NIT distinto de CF, el nombre o razon social es obligatorio.
  .refine((d) => d.nitFactura === undefined || d.nitFactura === 'CF' || !!d.nombreFactura, {
    path: ['nombreFactura'],
    message: 'El nombre o razon social es obligatorio cuando se factura con NIT',
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
