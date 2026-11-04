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

/** Un atributo de una variante (p. ej. { Nombre: 'Viscosidad', Valor: '5W-30' }). */
export interface Atributo {
  Nombre: string;
  Valor: string;
}

/** Variante de un producto, tal como la devuelve SP_Catalogo_ObtenerProducto. */
export interface Variante {
  IDVariante: number;
  SKU: string;
  Precio: number;
  Activo: boolean;
  Existencia: number;
  Reservado: number;
  Disponible: number;
  atributos: Atributo[];
}

/** Imagen de un producto. */
export interface Imagen {
  IDProductoImagen: number;
  IDProducto: number;
  Url: string;
  Orden: number;
  EsPrincipal: boolean;
}

/** Cabecera del producto en el detalle. */
export interface ProductoCabecera {
  IDProducto: number;
  IDCategoria: number;
  Categoria: string;
  Nombre: string;
  Descripcion: string | null;
  Activo: boolean;
  FechaCreacion: string;
  FechaActualizacion: string | null;
}

/** Respuesta de GET /catalogo/productos/:id. */
export interface ProductoDetalle {
  producto: ProductoCabecera;
  variantes: Variante[];
  imagenes: Imagen[];
}

/** Parametros de busqueda del catalogo (query de busquedaSchema). */
export interface BusquedaParams {
  texto?: string;
  idCategoria?: number;
  precioMin?: number;
  precioMax?: number;
  soloDisponibles?: boolean;
  orden?: 'Nombre' | 'Precio' | 'FechaCreacion';
  direccion?: 'ASC' | 'DESC';
  pagina?: number;
  tamanoPagina?: number;
}

/** Respuesta de GET /catalogo/productos. */
export interface PaginaProductos {
  filas: ProductoResumen[];
  total: number;
  pagina: number;
  tamanoPagina: number;
}

/** Totales del carrito, calculados por la BD (el front nunca los recalcula). */
export interface CarritoTotales {
  Subtotal: number;
  Descuento: number;
  Total: number;
  PorcentajeIVA: number;
  BaseImponible: number;
  IVA: number;
  CantidadLineas: number;
  CantidadUnidades: number;
}

/** Cabecera del carrito con sus totales. IDCarrito es null si aun no existe. */
export interface CarritoCabecera {
  IDCarrito: number | null;
  TokenInvitado: string | null;
  Estado: string | null;
  FechaUltimaActividad: string | null;
  totales: CarritoTotales;
}

/** Linea del carrito. */
export interface LineaCarrito {
  IDCarritoDetalle: number;
  IDVariante: number;
  SKU: string;
  IDProducto: number;
  Producto: string;
  Categoria: string;
  ImagenPrincipal: string | null;
  Cantidad: number;
  PrecioUnitario: number;
  TotalLinea: number;
  Disponible: number;
  VarianteActiva: boolean;
  Advertencia: string | null;
}

/** Cupon aplicado al carrito (M5). */
export interface CuponCarrito {
  IDCupon: number;
  Codigo: string;
  TipoDescuento: 'PORCENTAJE' | 'MONTO';
  Valor: number;
  Categoria: string | null;
  descuento: {
    baseElegible: number;
    descuento: number;
    valido: boolean;
    causa: string | null;
  };
}

/** Respuesta de GET /carrito y POST /carrito/items. */
export interface RespuestaCarrito {
  carrito: CarritoCabecera | null;
  lineas: LineaCarrito[];
  cupon: CuponCarrito | null;
  cartToken?: string;
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
