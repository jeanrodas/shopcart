import { z } from 'zod';

/**
 * Fecha ISO obligatoria, convertida a Date. Rechaza cadenas invalidas.
 * El SP valida el orden (Hasta > Desde) y el tope de 366 dias (-> 400).
 */
const fechaIso = z.coerce.date({ message: 'fecha ISO invalida' });

/**
 * Rango de fechas base, compartido por los reportes con periodo. El rango es
 * SEMIABIERTO: [desde, hasta) -> incluye `desde` y EXCLUYE `hasta` (lo aplican los
 * SPs de 020). El orden y el tope de 366 dias los valida el SP (-> 400).
 */
export const rangoSchema = z.object({
  desde: fechaIso,
  hasta: fechaIso,
});

/** GET /reportes/ventas (+ export): rango + agrupacion. */
export const ventasQuerySchema = rangoSchema.extend({
  agrupacion: z.enum(['DIA', 'SEMANA', 'MES']),
});

/** GET /reportes/top-productos (+ export): rango + top acotado. */
export const topProductosQuerySchema = rangoSchema.extend({
  top: z.coerce.number().int().min(1).max(50).default(10),
});

/** GET /reportes/carritos-abandonados: paginacion. */
export const carritosQuerySchema = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  tamanoPagina: z.coerce.number().int().positive().max(100).default(20),
});

export type RangoQuery = z.infer<typeof rangoSchema>;
export type VentasQuery = z.infer<typeof ventasQuerySchema>;
export type TopProductosQuery = z.infer<typeof topProductosQuerySchema>;
export type CarritosQuery = z.infer<typeof carritosQuerySchema>;
