/** Tipos de las respuestas de la API ShopCart usados por el frontend. */

export type Rol = 'Cliente' | 'Operador' | 'Administrador';

export interface Usuario {
  id: number;
  correo: string;
  nombre: string;
  rol: Rol;
}

export interface CarritoFusionado {
  lineas: number;
  advertencias: unknown[];
}

export interface RespuestaSesion {
  accessToken: string;
  refreshToken: string;
  usuario: Usuario;
  carritoFusionado?: CarritoFusionado | null;
}

export interface ProductoResumen {
  IDProducto: number;
  Nombre: string;
  Descripcion: string | null;
  IDCategoria: number;
  Categoria: string;
  Activo: boolean;
  FechaCreacion: string;
  PrecioMinimo: number | null;
  PrecioMaximo: number | null;
  VariantesActivas: number;
  HayDisponible: boolean;
  DisponibleTotal: number;
  BajoStock: boolean;
  ImagenPrincipal: string | null;
}

export interface MasVendido extends ProductoResumen {
  UnidadesVendidas: number;
  Posicion: number;
}

export interface Oferta extends ProductoResumen {
  CuponCodigo: string;
  /** Las ofertas solo provienen de cupones de categoria PORCENTAJE. */
  TipoDescuento: 'PORCENTAJE';
  Valor: number;
  MontoMinimo: number;
  PrecioConCupon: number;
}

export interface Destacados {
  masVendidos: MasVendido[];
  ofertas: Oferta[];
}

export interface Categoria {
  IDCategoria: number;
  Nombre: string;
  Descripcion: string | null;
  Activo: boolean;
  FechaCreacion: string;
  CantidadProductosActivos: number;
  ProductosVisibles: number;
}

export interface Metadatos {
  nombre: string;
  version: string;
  fase: string;
  modoDemo: boolean;
}

export interface CuponVigente {
  IDCupon: number;
  Codigo: string;
  TipoDescuento: 'PORCENTAJE' | 'MONTO';
  Valor: number;
  IDCategoria: number | null;
  Categoria: string | null;
  MontoMinimo: number;
  FechaFin: string;
}
