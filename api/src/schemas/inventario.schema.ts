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
  // RF-03: el motivo solo es OBLIGATORIO para ajustes. En una entrada de compra es opcional
  // (si se envia, 3-300 chars); el servicio pone un motivo por defecto para respetar el
  // invariante de M3 (Kardex.Motivo NOT NULL y el SP exige >= 3), sin tocar el SP evaluado.
  motivo: motivoSchema.optional(),
});

export const ajusteSchema = z.object({
  idVariante: idVarianteSchema,
  tipo: z.enum(['AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO']),
  cantidad: cantidadSchema,
  motivo: motivoSchema, // obligatorio (RF-03: un ajuste manual exige motivo)
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

/**
 * Query de GET /inventario/admin (F2, operacion). Listado por variante con chips de
 * filtro; @filtro acota a un subconjunto. Aditivo: no toca /inventario/existencias (M3).
 */
export const inventarioAdminQuerySchema = z.object({
  texto: z.string().trim().min(1).max(100).optional(),
  idCategoria: z.coerce.number().int().positive().optional(),
  // idProducto acota el listado a las variantes de un producto (boton "Inventario" de /admin/productos).
  idProducto: z.coerce.number().int().positive().optional(),
  filtro: z.enum(['bajoStock', 'agotadas', 'conReservas']).optional(),
  pagina: z.coerce.number().int().positive().default(1),
  tamano: z.coerce.number().int().positive().max(100).default(20),
  // Ordenamiento del lado del servidor (lista blanca; el SP revalida -> 50422).
  orden: z.enum(['sku', 'existencia', 'disponible', 'movimiento']).optional(),
  direccion: z.string().trim().toUpperCase().pipe(z.enum(['ASC', 'DESC'])).optional(),
});

/**
 * Cuerpo de POST /inventario/simular (F2): vista previa de un movimiento, solo lectura.
 * Mismos tipos expuestos que una entrada/ajuste; nunca escribe.
 */
export const simularSchema = z.object({
  idVariante: idVarianteSchema,
  tipo: z.enum(['ENTRADA_COMPRA', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO']),
  cantidad: cantidadSchema,
});

export type EntradaInput = z.infer<typeof entradaSchema>;
export type AjusteInput = z.infer<typeof ajusteSchema>;
export type ExistenciasQuery = z.infer<typeof existenciasQuerySchema>;
export type KardexQuery = z.infer<typeof kardexQuerySchema>;
export type InventarioAdminQuery = z.infer<typeof inventarioAdminQuerySchema>;
export type SimularInput = z.infer<typeof simularSchema>;
