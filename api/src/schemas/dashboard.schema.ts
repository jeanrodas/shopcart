import { z } from 'zod';
import { rangoSchema } from './reportes.schema.js';

/**
 * Query del dashboard (F9). El rango [desde, hasta) lo valida el SP (orden y tope de
 * 366 dias -> 400), igual que los reportes de M9. Reutiliza rangoSchema de M9.
 */
export const dashboardRangoSchema = rangoSchema;

/**
 * GET /dashboard/ventas-dia: rango + granularidad (RF-08). El SP agrupa con DATETRUNC por
 * DIA|SEMANA|MES; valida el valor (-> 50422). DIA por defecto (compat. con el comportamiento previo).
 */
export const dashboardVentasQuerySchema = rangoSchema.extend({
  granularidad: z.string().trim().toUpperCase().pipe(z.enum(['DIA', 'SEMANA', 'MES'])).default('DIA'),
});

/** GET /dashboard/cupones: rango + top acotado (cupones mas usados del periodo). */
export const dashboardCuponesQuerySchema = rangoSchema.extend({
  top: z.coerce.number().int().min(1).max(50).default(8),
});

/**
 * GET /dashboard/horas-pico: rango + zona horaria opcional (nombre de sys.time_zone_info).
 * El SP valida el nombre contra sys.time_zone_info (-> 50422) y por defecto usa Guatemala.
 */
export const dashboardHorasQuerySchema = rangoSchema.extend({
  zona: z.string().min(1).max(64).optional(),
});

export type DashboardRangoQuery = z.infer<typeof dashboardRangoSchema>;
export type DashboardVentasQuery = z.infer<typeof dashboardVentasQuerySchema>;
export type DashboardCuponesQuery = z.infer<typeof dashboardCuponesQuerySchema>;
export type DashboardHorasQuery = z.infer<typeof dashboardHorasQuerySchema>;
