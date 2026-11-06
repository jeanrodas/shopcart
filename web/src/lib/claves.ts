import type { BusquedaParams, FiltrosAdmin, FiltrosPedidos } from '../api/tipos';

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
  direcciones: ['direcciones'] as const,
  pedidos: {
    // Raiz para invalidar todo (lista + resumen + detalle) tras una cancelacion.
    todos: ['pedidos'] as const,
    lista: (filtros: FiltrosPedidos) => ['pedidos', filtros] as const,
    resumen: ['pedidos', 'resumen'] as const,
    uno: (id: number) => ['pedidos', id] as const,
  },
  checkout: {
    resumen: ['checkout', 'resumen'] as const,
  },
  cuenta: {
    perfil: ['cuenta', 'perfil'] as const,
  },
  admin: {
    // Raiz para invalidar todo el catalogo admin (lista + conteos + detalle) tras una escritura.
    todo: ['admin', 'catalogo'] as const,
    productos: (filtros: FiltrosAdmin) => ['admin', 'catalogo', 'productos', filtros] as const,
    producto: (id: number) => ['admin', 'catalogo', 'producto', id] as const,
    categorias: ['admin', 'catalogo', 'categorias'] as const,
  },
  sistema: {
    metadatos: ['sistema', 'metadatos'] as const,
  },
};
