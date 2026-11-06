import { peticion } from './clienteHttp';
import type {
  CategoriaAdmin,
  FiltrosAdmin,
  ImagenBody,
  PaginaAdmin,
  ProductoBody,
  ProductoDetalle,
  VarianteBody,
} from './tipos';

/* ------------------------------- Productos -------------------------------- */

function queryAdmin(f: FiltrosAdmin): string {
  const qs = new URLSearchParams();
  if (f.texto) qs.set('texto', f.texto);
  if (f.idCategoria !== undefined) qs.set('idCategoria', String(f.idCategoria));
  if (f.estado) qs.set('estado', f.estado);
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

interface Pagina {
  total: number;
}

/**
 * Pedidos "en operacion" (PAGADO + EN_PREPARACION). SP_Pedidos_Listar filtra por un
 * estado a la vez, asi que se suman dos conteos (pagina minima: solo interesa el total).
 */
export async function contarPedidosOperacion(): Promise<number> {
  const [a, b] = await Promise.all([
    peticion<Pagina>('/api/v1/pedidos?estado=PAGADO&pagina=1&tamanoPagina=1'),
    peticion<Pagina>('/api/v1/pedidos?estado=EN_PREPARACION&pagina=1&tamanoPagina=1'),
  ]);
  return (a?.total ?? 0) + (b?.total ?? 0);
}

/** Variantes en bajo stock (badge rojo de Inventario). */
export async function contarVariantesBajoStock(): Promise<number> {
  const r = await peticion<Pagina>(
    '/api/v1/inventario/existencias?soloBajoStock=true&pagina=1&tamanoPagina=1',
  );
  return r?.total ?? 0;
}
