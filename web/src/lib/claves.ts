import type { BusquedaParams } from '../api/tipos';

/** Convencion de claves de cache por modulo para TanStack Query. */
export const claves = {
  catalogo: {
    destacados: ['catalogo', 'destacados'] as const,
    categorias: ['catalogo', 'categorias'] as const,
    productos: (params: BusquedaParams) => ['catalogo', 'productos', params] as const,
    producto: (id: number) => ['catalogo', 'producto', id] as const,
  },
  cupones: {
    vigentes: ['cupones', 'vigentes'] as const,
  },
  carrito: ['carrito'] as const,
  sistema: {
    metadatos: ['sistema', 'metadatos'] as const,
  },
};
