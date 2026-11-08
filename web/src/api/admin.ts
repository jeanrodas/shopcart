import { peticion } from './clienteHttp';
import type {
  CategoriaAdmin,
  FiltrosAdmin,
  ImagenBody,
  PaginaAdmin,
  ProductoBody,
  ProductoDetalle,
  RespuestaResumenInventario,
  ResumenOperacion,
  VarianteBody,
} from './tipos';

/* ------------------------------- Productos -------------------------------- */

function queryAdmin(f: FiltrosAdmin): string {
  const qs = new URLSearchParams();
  if (f.texto) qs.set('texto', f.texto);
  if (f.idCategoria !== undefined) qs.set('idCategoria', String(f.idCategoria));
  if (f.estado) qs.set('estado', f.estado);
  if (f.orden) qs.set('orden', f.orden);
  if (f.direccion) qs.set('direccion', f.direccion);
  qs.set('pagina', String(f.pagina));
  qs.set('tamano', String(f.tamano));
  return `?${qs.toString()}`;
}

export function listarProductosAdmin(filtros: FiltrosAdmin): Promise<PaginaAdmin> {
  return peticion<PaginaAdmin>(`/api/v1/productos-admin${queryAdmin(filtros)}`);
}

/** Detalle de administracion (incluye inactivos): producto + variantes + imagenes. */
export function obtenerProductoAdmin(id: number): Promise<ProductoDetalle> {
  return peticion<ProductoDetalle>(`/api/v1/productos/${id}?incluirInactivos=true`);
}

export function crearProducto(body: ProductoBody): Promise<{ IDProducto: number }> {
  return peticion<{ IDProducto: number }>('/api/v1/productos', { method: 'POST', body });
}

export function actualizarProducto(id: number, body: ProductoBody): Promise<unknown> {
  return peticion(`/api/v1/productos/${id}`, { method: 'PUT', body });
}

export function cambiarEstadoProducto(id: number, activo: boolean): Promise<unknown> {
  return peticion(`/api/v1/productos/${id}/estado`, { method: 'PATCH', body: { activo } });
}

/* ------------------------------- Variantes -------------------------------- */

export function crearVariante(idProducto: number, body: VarianteBody): Promise<{ IDVariante: number }> {
  return peticion<{ IDVariante: number }>(`/api/v1/productos/${idProducto}/variantes`, {
    method: 'POST',
    body,
  });
}

export function actualizarVariante(idVariante: number, body: VarianteBody): Promise<unknown> {
  return peticion(`/api/v1/variantes/${idVariante}`, { method: 'PUT', body });
}

export function cambiarEstadoVariante(idVariante: number, activo: boolean): Promise<unknown> {
  return peticion(`/api/v1/variantes/${idVariante}/estado`, { method: 'PATCH', body: { activo } });
}

/* -------------------------------- Imagenes -------------------------------- */

export function agregarImagen(idProducto: number, body: ImagenBody): Promise<unknown> {
  return peticion(`/api/v1/productos/${idProducto}/imagenes`, { method: 'POST', body });
}

export function eliminarImagen(idProducto: number, idImagen: number): Promise<void> {
  return peticion(`/api/v1/productos/${idProducto}/imagenes/${idImagen}`, { method: 'DELETE' });
}

export function marcarImagenPrincipal(idProducto: number, idImagen: number): Promise<unknown> {
  return peticion(`/api/v1/productos/${idProducto}/imagenes/${idImagen}/principal`, {
    method: 'PATCH',
  });
}

/* ------------------------------- Categorias ------------------------------- */

export function listarCategoriasAdmin(incluirInactivas = true): Promise<CategoriaAdmin[]> {
  const q = incluirInactivas ? '?incluirInactivas=true' : '';
  return peticion<CategoriaAdmin[]>(`/api/v1/categorias${q}`);
}

export function crearCategoria(body: { nombre: string; descripcion?: string }): Promise<unknown> {
  return peticion('/api/v1/categorias', { method: 'POST', body });
}

export function actualizarCategoria(
  id: number,
  body: { nombre: string; descripcion?: string },
): Promise<unknown> {
  return peticion(`/api/v1/categorias/${id}`, { method: 'PUT', body });
}

export function cambiarEstadoCategoria(id: number, activo: boolean): Promise<unknown> {
  return peticion(`/api/v1/categorias/${id}/estado`, { method: 'PATCH', body: { activo } });
}

/* ----------------------- Badges del area interna -------------------------- */

/** Conteo + desglose para el tooltip de un badge del area interna. */
export interface DatoBadge {
  total: number;
  titulo: string;
}

/**
 * Pedidos "por preparar" (PAGADO + EN_PREPARACION), fuente unica: el resumen de
 * operacion (SP_Pedidos_ResumenOperacion), que tambien alimenta la cabecera de
 * /admin/pedidos. El tooltip desglosa "N por preparar (PAGADO) · M por despachar (EN_PREPARACION)".
 */
export async function badgePedidos(): Promise<DatoBadge> {
  const r = await peticion<ResumenOperacion>('/api/v1/pedidos/resumen-operacion');
  const porPreparar = r?.Pagado ?? 0;
  const porDespachar = r?.EnPreparacion ?? 0;
  return {
    total: r?.PorPreparar ?? porPreparar + porDespachar,
    titulo: `${porPreparar} por preparar · ${porDespachar} por despachar`,
  };
}

/**
 * Variantes que requieren atencion en inventario (bajo stock + agotadas), del resumen de
 * inventario (SP_Inventario_Resumen): misma fuente que el tablero de /admin/inventario.
 */
export async function badgeInventario(): Promise<DatoBadge> {
  const r = await peticion<RespuestaResumenInventario>('/api/v1/inventario/resumen');
  const bajoStock = r?.resumen?.VariantesBajoStock ?? 0;
  const agotadas = r?.resumen?.VariantesAgotadas ?? 0;
  return { total: bajoStock + agotadas, titulo: `${bajoStock} bajo stock · ${agotadas} agotadas` };
}
