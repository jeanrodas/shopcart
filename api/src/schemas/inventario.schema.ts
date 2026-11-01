import { z } from 'zod';
import { textoPlano } from './common.schema.js';

const motivoSchema = textoPlano(300, 3);
const cantidadSchema = z.coerce.number().int().min(1).max(100000);
const idVarianteSchema = z.coerce.number().int().positive();

const boolQuery = (def: 'true' | 'false' = 'false') =>
  z.enum(['true', 'false']).default(def).transform((v) => v === 'true');

export const entradaSchema = z.object({
  idVariante: idVarianteSchema,
  cantidad: cantidadSchema,
  motivo: motivoSchema,
});

export const ajusteSchema = z.object({
  idVariante: idVarianteSchema,
  tipo: z.enum(['AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO']),
  cantidad: cantidadSchema,
  motivo: motivoSchema,
});

export const existenciasQuerySchema = z.object({
  texto: z.string().trim().min(1).max(100).optional(),
  idCategoria: z.coerce.number().int().positive().optional(),
  soloBajoStock: boolQuery(),
  incluirInactivas: boolQuery(),
  orden: z.enum(['SKU', 'Producto', 'Existencia', 'Disponible', 'UltimoMovimiento']).default('SKU'),
  direccion: z.string().trim().toUpperCase().pipe(z.enum(['ASC', 'DESC'])).default('ASC'),
  pagina: z.coerce.number().int().positive().default(1),
  tamanoPagina: z.coerce.number().int().positive().max(100).default(20),
});

export const kardexQuerySchema = z
  .object({
    desde: z.string().datetime({ offset: true }).optional(),
    hasta: z.string().datetime({ offset: true }).optional(),
    pagina: z.coerce.number().int().positive().default(1),
    tamanoPagina: z.coerce.number().int().positive().max(100).default(20),
  })
  .refine(
    (q) => q.desde === undefined || q.hasta === undefined || new Date(q.desde) <= new Date(q.hasta),
    { message: 'desde no puede ser mayor que hasta', path: ['desde'] },
  );

export type EntradaInput = z.infer<typeof entradaSchema>;
export type AjusteInput = z.infer<typeof ajusteSchema>;
export type ExistenciasQuery = z.infer<typeof existenciasQuerySchema>;
export type KardexQuery = z.infer<typeof kardexQuerySchema>;
