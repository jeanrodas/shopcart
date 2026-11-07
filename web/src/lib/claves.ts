import type {
  BusquedaParams,
  FiltrosAdmin,
  FiltrosInventario,
  FiltrosPedidos,
  FiltrosPedidosOperacion,
} from '../api/tipos';

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
  inventario: {
    // Raiz para invalidar todo el inventario (tabla + resumen + kardex) tras un movimiento.
    todo: ['inventario'] as const,
    lista: (filtros: FiltrosInventario) => ['inventario', 'lista', filtros] as const,
    resumen: ['inventario', 'resumen'] as const,
    kardex: (idVariante: number) => ['inventario', 'kardex', idVariante] as const,
    consistencia: ['inventario', 'consistencia'] as const,
  },
  operacion: {
    // Raiz para invalidar operacion (lista + resumen + detalle) tras una transicion.
    todo: ['operacion'] as const,
    lista: (filtros: FiltrosPedidosOperacion) => ['operacion', 'lista', filtros] as const,
    resumen: ['operacion', 'resumen'] as const,
    uno: (id: number) => ['operacion', 'pedido', id] as const,
  },
};
