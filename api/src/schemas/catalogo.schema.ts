import { z } from 'zod';
import { textoPlano, textoLargo } from './common.schema.js';

const dosDecimales = (v: number) => Number.isInteger(Math.round(v * 100));

/** Flag booleano que llega como 'true'/'false' en la query. */
const boolQuery = (def: 'true' | 'false' = 'false') =>
  z.enum(['true', 'false']).default(def).transform((v) => v === 'true');

const direccionQuery = z.string().trim().toUpperCase().pipe(z.enum(['ASC', 'DESC'])).default('ASC');
const ordenQuery = z.enum(['Nombre', 'Precio', 'FechaCreacion']).default('Nombre');

const rangoPrecioValido = (q: { precioMin?: number; precioMax?: number }) =>
  q.precioMin === undefined || q.precioMax === undefined || q.precioMin <= q.precioMax;
const rangoPrecioError = { message: 'precioMin no puede ser mayor que precioMax', path: ['precioMin'] };

const busquedaBase = {
  texto: z.string().trim().min(1).max(100).optional(),
  idCategoria: z.coerce.number().int().positive().optional(),
  precioMin: z.coerce.number().nonnegative().optional(),
  precioMax: z.coerce.number().nonnegative().optional(),
  soloDisponibles: boolQuery(),
  orden: ordenQuery,
  direccion: direccionQuery,
  pagina: z.coerce.number().int().positive().default(1),
  tamanoPagina: z.coerce.number().int().positive().max(100).default(20),
};

/** Busqueda publica del catalogo (incluirInactivos siempre forzado a 0 en el controlador). */
export const busquedaSchema = z.object(busquedaBase).refine(rangoPrecioValido, rangoPrecioError);

/** Busqueda de administracion: acepta incluirInactivos. */
export const busquedaAdminSchema = z
  .object({ ...busquedaBase, incluirInactivos: boolQuery() })
  .refine(rangoPrecioValido, rangoPrecioError);

/** Query de listado de categorias para administracion. */
export const listarCategoriasSchema = z.object({ incluirInactivas: boolQuery() });

/** Query de obtencion de un producto para administracion. */
export const obtenerProductoAdminSchema = z.object({ incluirInactivos: boolQuery() });

/** Listado de administracion del catalogo con estado derivado (SP_Catalogo_ListarAdmin). */
export const listarAdminSchema = z.object({
  texto: z.string().trim().min(1).max(100).optional(),
  idCategoria: z.coerce.number().int().positive().optional(),
  estado: z.enum(['publicado', 'agotado', 'incompleto', 'oculto', 'bajoStock']).optional(),
  pagina: z.coerce.number().int().positive().default(1),
  tamano: z.coerce.number().int().positive().max(100).default(20),
  // Ordenamiento del lado del servidor (lista blanca; el SP revalida -> 50422).
  orden: z.enum(['nombre', 'categoria', 'precio', 'disponible', 'estado']).optional(),
  direccion: z.string().trim().toUpperCase().pipe(z.enum(['ASC', 'DESC'])).optional(),
});

export const categoriaSchema = z.object({
  nombre: textoPlano(100),
  descripcion: textoLargo(300).optional(),
});

export const productoSchema = z.object({
  idCategoria: z.coerce.number().int().positive(),
  nombre: textoPlano(200),
  descripcion: textoLargo(4000).optional(),
});

const atributoSchema = z.object({
  nombre: textoPlano(50),
  valor: textoPlano(100),
});

export const varianteSchema = z.object({
  sku: textoPlano(50),
  precio: z.number().positive().max(99999999.99).refine(dosDecimales, 'maximo 2 decimales'),
  atributos: z
    .array(atributoSchema)
    .max(10)
    .default([])
    .refine(
      (arr) => new Set(arr.map((a) => a.nombre.toLowerCase())).size === arr.length,
      'los nombres de atributo deben ser unicos',
    ),
  // F2: imagen propia de la variante. Ausente = no se toca (ConservarImagen); null = quitar;
  // ruta "/..." (p. ej. /uploads/img/…) o URL http(s). Acepta lo mismo que imagenSchema.url.
  imagenURL: z
    .union([
      z
        .string()
        .trim()
        .max(500)
        .refine((v) => /^https?:\/\//i.test(v) || /^\/[^/]/.test(v), 'debe ser una URL http/https o una ruta que empiece con /'),
      z.null(),
    ])
    .optional(),
});

export const imagenSchema = z.object({
  url: z
    .string()
    .trim()
    .max(500)
    // Acepta una URL http/https o una ruta relativa a la raiz del sitio (p. ej.
    // /img/productos/LUB-SIN.jpeg), que es como el frontend sirve sus imagenes.
    .refine((v) => /^https?:\/\//i.test(v) || /^\/[^/]/.test(v), 'debe ser una URL http/https o una ruta que empiece con /'),
  orden: z.coerce.number().int().nonnegative().default(0),
  esPrincipal: z.boolean().default(false),
});

export const estadoSchema = z.object({
  activo: z.boolean(),
});

/** Query de productos destacados (publico): cuantos por seccion (1-24, default 8). */
export const destacadosSchema = z.object({
  limite: z.coerce.number().int().min(1).max(24).default(8),
});

/** Params de rutas de imagen: :id (producto) y :idImagen. */
export const imagenParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
  idImagen: z.coerce.number().int().positive(),
});

export type DestacadosQuery = z.infer<typeof destacadosSchema>;
export type BusquedaQuery = z.infer<typeof busquedaSchema>;
export type BusquedaAdminQuery = z.infer<typeof busquedaAdminSchema>;
export type ListarAdminQuery = z.infer<typeof listarAdminSchema>;
export type CategoriaInput = z.infer<typeof categoriaSchema>;
export type ProductoInput = z.infer<typeof productoSchema>;
export type VarianteInput = z.infer<typeof varianteSchema>;
export type ImagenInput = z.infer<typeof imagenSchema>;
