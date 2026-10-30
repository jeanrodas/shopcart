import { z } from 'zod';

const dosDecimales = (v: number) => Number.isInteger(Math.round(v * 100));

/** Codigo de cupon: 3-30, letras/numeros/guion, se normaliza a mayusculas. */
const codigo = z
  .string()
  .trim()
  .toUpperCase()
  .min(3)
  .max(30)
  .regex(/^[A-Z0-9-]+$/, 'solo letras, numeros y guion');

/** Flag booleano que llega como 'true'/'false' en la query (el default va antes del transform). */
const boolConDefault = z
  .enum(['true', 'false'])
  .default('false')
  .transform((v) => v === 'true');
const boolOpcional = z
  .enum(['true', 'false'])
  .transform((v) => v === 'true')
  .optional();

/** Cuerpo de creacion/actualizacion de un cupon (Administrador). */
export const cuponSchema = z
  .object({
    codigo,
    tipoDescuento: z.enum(['PORCENTAJE', 'MONTO']),
    valor: z.number().positive().refine(dosDecimales, 'maximo 2 decimales'),
    idCategoria: z.coerce.number().int().positive().optional(),
    montoMinimo: z.number().nonnegative().default(0).refine(dosDecimales, 'maximo 2 decimales'),
    fechaInicio: z.string().datetime({ message: 'fecha ISO invalida' }),
    fechaFin: z.string().datetime({ message: 'fecha ISO invalida' }),
    limiteUsosTotal: z.coerce.number().int().positive().optional(),
    limiteUsosPorCliente: z.coerce.number().int().positive().optional(),
  })
  .refine((d) => d.tipoDescuento !== 'PORCENTAJE' || d.valor <= 100, {
    message: 'un cupon de porcentaje no puede exceder 100',
    path: ['valor'],
  })
  .refine((d) => new Date(d.fechaFin) > new Date(d.fechaInicio), {
    message: 'fechaFin debe ser posterior a fechaInicio',
    path: ['fechaFin'],
  });

/** Query de listado de cupones (Administrador). */
export const listarCuponesSchema = z.object({
  texto: z.string().trim().min(1).max(50).optional(),
  activo: boolOpcional,
  soloVigentes: boolConDefault,
  pagina: z.coerce.number().int().positive().default(1),
  tamanoPagina: z.coerce.number().int().positive().max(100).default(20),
});

/** Cuerpo de POST /carrito/cupon: aplicar un codigo al carrito del cliente. */
export const aplicarCuponSchema = z.object({ codigo });

export type CuponInput = z.infer<typeof cuponSchema>;
export type ListarCuponesQuery = z.infer<typeof listarCuponesSchema>;
export type AplicarCuponInput = z.infer<typeof aplicarCuponSchema>;
