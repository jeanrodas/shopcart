import sql from 'mssql';
import { executeSp } from '../data/spExecutor.js';
import { invalidarTodo } from '../utils/reportesCache.js';
import type {
  CategoriaInput,
  ProductoInput,
  VarianteInput,
  ImagenInput,
} from '../schemas/catalogo.schema.js';

export interface BusquedaParams {
  texto?: string;
  idCategoria?: number;
  precioMin?: number;
  precioMax?: number;
  soloDisponibles: boolean;
  orden: string;
  direccion: string;
  pagina: number;
  tamanoPagina: number;
}

interface AtributoRow {
  IDVariante: number;
  Nombre: string;
  Valor: string;
}

interface VarianteRow {
  IDVariante: number;
}

/** Construye el parametro de tipo tabla dbo.TVP_VarianteAtributo. */
function tvpAtributos(atributos: VarianteInput['atributos']): sql.Table {
  const tvp = new sql.Table('dbo.TVP_VarianteAtributo');
  tvp.columns.add('Nombre', sql.NVarChar(50), { nullable: false });
  tvp.columns.add('Valor', sql.NVarChar(100), { nullable: false });
  for (const a of atributos) {
    tvp.rows.add(a.nombre, a.valor);
  }
  return tvp;
}

/* --------------------------- Lectura publica/admin --------------------------- */

export async function listarCategorias(incluirInactivas: boolean): Promise<unknown[]> {
  const result = await executeSp('SP_Catalogo_ListarCategorias', [
    { name: 'IncluirInactivas', type: sql.Bit, value: incluirInactivas },
  ]);
  return result.recordset;
}

export async function buscarProductos(
  q: BusquedaParams,
  incluirInactivos: boolean,
): Promise<{ filas: unknown[]; total: number; pagina: number; tamanoPagina: number }> {
  const result = await executeSp('SP_Catalogo_BuscarProductos', [
    { name: 'Texto', type: sql.NVarChar(100), value: q.texto ?? null },
    { name: 'IDCategoria', type: sql.Int, value: q.idCategoria ?? null },
    { name: 'PrecioMin', type: sql.Decimal(18, 2), value: q.precioMin ?? null },
    { name: 'PrecioMax', type: sql.Decimal(18, 2), value: q.precioMax ?? null },
    { name: 'SoloDisponibles', type: sql.Bit, value: q.soloDisponibles },
    { name: 'IncluirInactivos', type: sql.Bit, value: incluirInactivos },
    { name: 'Orden', type: sql.NVarChar(30), value: q.orden },
    { name: 'Direccion', type: sql.NVarChar(4), value: q.direccion },
    { name: 'Pagina', type: sql.Int, value: q.pagina },
    { name: 'TamanoPagina', type: sql.Int, value: q.tamanoPagina },
  ]);

  const filas = (result.recordsets[0] ?? []) as unknown[];
  const total = (result.recordsets[1]?.[0] as { Total: number } | undefined)?.Total ?? 0;
  return { filas, total, pagina: q.pagina, tamanoPagina: q.tamanoPagina };
}

/**
 * Listado de administracion con estado derivado y conteos (SP_Catalogo_ListarAdmin).
 * Devuelve la pagina, el total del filtro y los conteos por estado (para chips/subtitulo).
 */
export async function listarAdmin(q: {
  texto?: string;
  idCategoria?: number;
  estado?: string;
  pagina: number;
  tamano: number;
}): Promise<{ filas: unknown[]; total: number; conteos: unknown; pagina: number; tamano: number }> {
  const result = await executeSp('SP_Catalogo_ListarAdmin', [
    { name: 'Texto', type: sql.NVarChar(100), value: q.texto ?? null },
    { name: 'IDCategoria', type: sql.Int, value: q.idCategoria ?? null },
    { name: 'Estado', type: sql.NVarChar(20), value: q.estado ?? null },
    { name: 'Pagina', type: sql.Int, value: q.pagina },
    { name: 'Tamano', type: sql.Int, value: q.tamano },
  ]);
  const filas = (result.recordsets[0] ?? []) as unknown[];
  const total = (result.recordsets[1]?.[0] as { Total: number } | undefined)?.Total ?? 0;
  const conteos = (result.recordsets[2]?.[0] ?? null) as unknown;
  return { filas, total, conteos, pagina: q.pagina, tamano: q.tamano };
}

export async function obtenerProducto(
  idProducto: number,
  incluirInactivos: boolean,
): Promise<unknown> {
  const result = await executeSp('SP_Catalogo_ObtenerProducto', [
    { name: 'IDProducto', type: sql.Int, value: idProducto },
    { name: 'IncluirInactivos', type: sql.Bit, value: incluirInactivos },
  ]);

  const producto = result.recordsets[0]?.[0] ?? null;
  const variantes = (result.recordsets[1] ?? []) as VarianteRow[];
  const atributos = (result.recordsets[2] ?? []) as unknown as AtributoRow[];
  const imagenes = (result.recordsets[3] ?? []) as unknown[];

  const atributosPorVariante = new Map<number, Array<{ Nombre: string; Valor: string }>>();
  for (const a of atributos) {
    const lista = atributosPorVariante.get(a.IDVariante) ?? [];
    lista.push({ Nombre: a.Nombre, Valor: a.Valor });
    atributosPorVariante.set(a.IDVariante, lista);
  }

  return {
    producto,
    variantes: variantes.map((v) => ({
      ...v,
      atributos: atributosPorVariante.get(v.IDVariante) ?? [],
    })),
    imagenes,
  };
}

export async function destacados(
  limite: number,
): Promise<{ masVendidos: unknown[]; ofertas: unknown[] }> {
  const result = await executeSp('SP_Catalogo_Destacados', [
    { name: 'Limite', type: sql.Int, value: limite },
  ]);
  return {
    masVendidos: (result.recordsets[0] ?? []) as unknown[],
    ofertas: (result.recordsets[1] ?? []) as unknown[],
  };
}

/* ------------------------------- Categorias ------------------------------- */

export async function crearCategoria(datos: CategoriaInput, actorId: number): Promise<unknown> {
  const result = await executeSp('SP_Catalogo_CrearCategoria', [
    { name: 'Nombre', type: sql.NVarChar(100), value: datos.nombre },
    { name: 'Descripcion', type: sql.NVarChar(300), value: datos.descripcion ?? null },
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: actorId },
  ]);
  return result.recordset[0];
}

export async function actualizarCategoria(
  idCategoria: number,
  datos: CategoriaInput,
  actorId: number,
): Promise<unknown> {
  const result = await executeSp('SP_Catalogo_ActualizarCategoria', [
    { name: 'IDCategoria', type: sql.Int, value: idCategoria },
    { name: 'Nombre', type: sql.NVarChar(100), value: datos.nombre },
    { name: 'Descripcion', type: sql.NVarChar(300), value: datos.descripcion ?? null },
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: actorId },
  ]);
  return result.recordset[0];
}

export async function cambiarEstadoCategoria(
  idCategoria: number,
  activo: boolean,
  actorId: number,
): Promise<unknown> {
  const result = await executeSp('SP_Catalogo_CambiarEstadoCategoria', [
    { name: 'IDCategoria', type: sql.Int, value: idCategoria },
    { name: 'Activo', type: sql.Bit, value: activo },
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: actorId },
  ]);
  return result.recordset[0];
}

/* -------------------------------- Productos ------------------------------- */

export async function crearProducto(datos: ProductoInput, actorId: number): Promise<unknown> {
  const result = await executeSp('SP_Catalogo_CrearProducto', [
    { name: 'IDCategoria', type: sql.Int, value: datos.idCategoria },
    { name: 'Nombre', type: sql.NVarChar(200), value: datos.nombre },
    { name: 'Descripcion', type: sql.NVarChar(sql.MAX), value: datos.descripcion ?? null },
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: actorId },
  ]);
  return result.recordset[0];
}

export async function actualizarProducto(
  idProducto: number,
  datos: ProductoInput,
  actorId: number,
): Promise<unknown> {
  const result = await executeSp('SP_Catalogo_ActualizarProducto', [
    { name: 'IDProducto', type: sql.Int, value: idProducto },
    { name: 'IDCategoria', type: sql.Int, value: datos.idCategoria },
    { name: 'Nombre', type: sql.NVarChar(200), value: datos.nombre },
    { name: 'Descripcion', type: sql.NVarChar(sql.MAX), value: datos.descripcion ?? null },
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: actorId },
  ]);
  return result.recordset[0];
}

export async function cambiarEstadoProducto(
  idProducto: number,
  activo: boolean,
  actorId: number,
): Promise<unknown> {
  const result = await executeSp('SP_Catalogo_CambiarEstadoProducto', [
    { name: 'IDProducto', type: sql.Int, value: idProducto },
    { name: 'Activo', type: sql.Bit, value: activo },
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: actorId },
  ]);
  // El alta/baja del producto puede afectar reportes: invalida el cache.
  invalidarTodo();
  return result.recordset[0];
}

/* -------------------------------- Variantes ------------------------------- */

export async function crearVariante(
  idProducto: number,
  datos: VarianteInput,
  actorId: number,
): Promise<unknown> {
  const result = await executeSp('SP_Catalogo_CrearVariante', [
    { name: 'IDProducto', type: sql.Int, value: idProducto },
    { name: 'SKU', type: sql.NVarChar(50), value: datos.sku },
    { name: 'Precio', type: sql.Decimal(18, 2), value: datos.precio },
    { name: 'Atributos', value: tvpAtributos(datos.atributos) },
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: actorId },
    { name: 'ImagenURL', type: sql.NVarChar(500), value: datos.imagenURL ?? null },
  ]);
  return { variante: result.recordsets[0]?.[0] ?? null, atributos: result.recordsets[1] ?? [] };
}

export async function actualizarVariante(
  idVariante: number,
  datos: VarianteInput,
  actorId: number,
): Promise<unknown> {
  const result = await executeSp('SP_Catalogo_ActualizarVariante', [
    { name: 'IDVariante', type: sql.Int, value: idVariante },
    { name: 'SKU', type: sql.NVarChar(50), value: datos.sku },
    { name: 'Precio', type: sql.Decimal(18, 2), value: datos.precio },
    { name: 'Atributos', value: tvpAtributos(datos.atributos) },
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: actorId },
    // Si el body no trae imagenURL (consumidores de M2), ConservarImagen=1 no toca la columna.
    { name: 'ConservarImagen', type: sql.Bit, value: datos.imagenURL === undefined },
    { name: 'ImagenURL', type: sql.NVarChar(500), value: datos.imagenURL ?? null },
  ]);
  // El precio/atributos de la variante pueden afectar reportes: invalida el cache.
  invalidarTodo();
  return { variante: result.recordsets[0]?.[0] ?? null, atributos: result.recordsets[1] ?? [] };
}

export async function cambiarEstadoVariante(
  idVariante: number,
  activo: boolean,
  actorId: number,
): Promise<unknown> {
  const result = await executeSp('SP_Catalogo_CambiarEstadoVariante', [
    { name: 'IDVariante', type: sql.Int, value: idVariante },
    { name: 'Activo', type: sql.Bit, value: activo },
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: actorId },
  ]);
  // El alta/baja de la variante cambia las variantes bajo stock: invalida el cache.
  invalidarTodo();
  return result.recordset[0];
}

/* --------------------------------- Imagenes ------------------------------- */

export async function agregarImagen(
  idProducto: number,
  datos: ImagenInput,
  actorId: number,
): Promise<unknown> {
  const result = await executeSp('SP_Catalogo_AgregarImagen', [
    { name: 'IDProducto', type: sql.Int, value: idProducto },
    { name: 'Url', type: sql.NVarChar(500), value: datos.url },
    { name: 'Orden', type: sql.Int, value: datos.orden },
    { name: 'EsPrincipal', type: sql.Bit, value: datos.esPrincipal },
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: actorId },
  ]);
  return result.recordset[0];
}

export async function eliminarImagen(
  idProductoImagen: number,
  idProducto: number,
  actorId: number,
): Promise<void> {
  await executeSp('SP_Catalogo_EliminarImagen', [
    { name: 'IDProductoImagen', type: sql.Int, value: idProductoImagen },
    { name: 'IDProducto', type: sql.Int, value: idProducto },
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: actorId },
  ]);
}

export async function marcarImagenPrincipal(
  idProductoImagen: number,
  idProducto: number,
  actorId: number,
): Promise<unknown> {
  const result = await executeSp('SP_Catalogo_MarcarImagenPrincipal', [
    { name: 'IDProductoImagen', type: sql.Int, value: idProductoImagen },
    { name: 'IDProducto', type: sql.Int, value: idProducto },
    { name: 'IDUsuarioEjecuta', type: sql.Int, value: actorId },
  ]);
  return result.recordset[0];
}
