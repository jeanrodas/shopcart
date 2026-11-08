import { peticion } from './clienteHttp';
import type {
  BusquedaParams,
  Categoria,
  Destacados,
  PaginaProductos,
  ProductoDetalle,
} from './tipos';

export function obtenerDestacados(limite = 8): Promise<Destacados> {
  return peticion<Destacados>(`/api/v1/catalogo/destacados?limite=${limite}`);
}

export function obtenerCategorias(): Promise<Categoria[]> {
  return peticion<Categoria[]>('/api/v1/catalogo/categorias');
}

/** Arma los query params EXACTOS de busquedaSchema (omite los indefinidos). */
function queryBusqueda(params: BusquedaParams): string {
  const qs = new URLSearchParams();
  if (params.texto) qs.set('texto', params.texto);
  if (params.idCategoria !== undefined) qs.set('idCategoria', String(params.idCategoria));
  if (params.precioMin !== undefined) qs.set('precioMin', String(params.precioMin));
  if (params.precioMax !== undefined) qs.set('precioMax', String(params.precioMax));
  if (params.soloDisponibles) qs.set('soloDisponibles', 'true');
  if (params.orden) qs.set('orden', params.orden);
  if (params.direccion) qs.set('direccion', params.direccion);
  if (params.pagina !== undefined) qs.set('pagina', String(params.pagina));
  if (params.tamanoPagina !== undefined) qs.set('tamanoPagina', String(params.tamanoPagina));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export function buscarProductos(params: BusquedaParams): Promise<PaginaProductos> {
  return peticion<PaginaProductos>(`/api/v1/catalogo/productos${queryBusqueda(params)}`);
}

export function obtenerProducto(id: number): Promise<ProductoDetalle> {
  return peticion<ProductoDetalle>(`/api/v1/catalogo/productos/${id}`);
}
