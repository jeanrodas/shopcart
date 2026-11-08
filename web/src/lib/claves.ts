import type {
  BusquedaParams,
  FiltrosAdmin,
  FiltrosBitacora,
  FiltrosCupones,
  FiltrosInventario,
  FiltrosPedidos,
  FiltrosPedidosOperacion,
  FiltrosUsuarios,
  RangoDashboard,
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
    // Raiz para invalidar la administracion de cupones (lista + resumen) tras una escritura.
    admin: ['cupones', 'admin'] as const,
    lista: (filtros: FiltrosCupones) => ['cupones', 'admin', 'lista', filtros] as const,
    resumen: ['cupones', 'admin', 'resumen'] as const,
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
  bitacora: {
    todo: ['bitacora'] as const,
    lista: (filtros: FiltrosBitacora) => ['bitacora', 'lista', filtros] as const,
    modulos: ['bitacora', 'modulos'] as const,
    registro: (tabla: string, id: number) => ['bitacora', 'registro', tabla, id] as const,
  },
  usuarios: {
    // Raiz para invalidar la administracion de usuarios tras una escritura.
    admin: ['usuarios', 'admin'] as const,
    lista: (filtros: FiltrosUsuarios) => ['usuarios', 'admin', 'lista', filtros] as const,
  },
  dashboard: {
    todo: ['dashboard'] as const,
    resumen: (r: RangoDashboard) => ['dashboard', 'resumen', r] as const,
    ventasDia: (r: RangoDashboard) => ['dashboard', 'ventas-dia', r] as const,
    categorias: (r: RangoDashboard) => ['dashboard', 'categorias', r] as const,
    embudo: (r: RangoDashboard) => ['dashboard', 'embudo', r] as const,
    horas: (r: RangoDashboard) => ['dashboard', 'horas', r] as const,
    top: (r: RangoDashboard) => ['dashboard', 'top', r] as const,
    cupones: (r: RangoDashboard) => ['dashboard', 'cupones', r] as const,
  },
};
