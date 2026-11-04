import { peticion } from './clienteHttp';
import type { Categoria, Destacados } from './tipos';

export function obtenerDestacados(limite = 8): Promise<Destacados> {
  return peticion<Destacados>(`/api/v1/catalogo/destacados?limite=${limite}`);
}

export function obtenerCategorias(): Promise<Categoria[]> {
  return peticion<Categoria[]>('/api/v1/catalogo/categorias');
}
