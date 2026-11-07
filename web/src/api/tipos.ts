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
  /** F2: imagen propia de la variante (null = usa la del producto). */
  ImagenURL: string | null;
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

/** Direccion de entrega del usuario (GET /direcciones). */
export interface Direccion {
  IDDireccion: number;
  IDUsuario: number;
  Alias: string;
  NombreReceptor: string;
  Telefono: string;
  Linea1: string;
  Linea2: string | null;
  Municipio: string;
  Departamento: string;
  CodigoPostal: string | null;
  Referencia: string | null;
  Activo: boolean;
  FechaCreacion: string;
}

/** Datos que acepta el formulario de direccion (mismas reglas que direccionSchema). */
export interface DireccionInput {
  alias: string;
  nombreReceptor: string;
  telefono: string;
  linea1: string;
  linea2?: string;
  municipio: string;
  departamento: string;
  codigoPostal?: string;
  referencia?: string;
}

/** Linea reservada que devuelve /checkout/iniciar y /checkout/resumen (recordset 2). */
export interface LineaReservada {
  IDVariante: number;
  SKU: string;
  Cantidad: number;
  FechaExpira: string;
}

export interface TotalesCheckout {
  Subtotal: number;
  Descuento: number;
  Total: number;
  PorcentajeIVA: number;
  BaseImponible: number;
  IVA: number;
  CantidadLineas: number;
  CantidadUnidades: number;
}

/** Respuesta de POST /checkout/iniciar y GET /checkout/resumen. */
export interface ResumenCheckout {
  resumen: {
    IDCarrito: number;
    IDDireccion: number | null;
    DireccionTexto: string | null;
    totales: TotalesCheckout;
    CostoEnvio: number;
    TotalConEnvio: number;
    ExpiraEn: string | null;
    Minutos: number;
    /** Solo en GET /checkout/resumen. */
    ReservaActiva?: boolean;
  } | null;
  lineas: LineaReservada[];
}

/** Cuerpo de POST /checkout/pagar. */
export interface PagarBody {
  idDireccion: number;
  metodoPago: 'TARJETA' | 'TRANSFERENCIA' | 'EFECTIVO';
  simularResultado?: 'APROBADO' | 'RECHAZADO';
  nombreFactura?: string;
  nitFactura?: string;
}

/** Respuesta de POST /checkout/pagar (misma forma en 201 aprobado y 402 rechazado). */
export interface ResultadoPago {
  aprobado: boolean;
  replay: boolean;
  pago: {
    IDPago: number;
    Estado: string;
    MensajeResultado: string | null;
    ClaveIdempotencia: string;
    Monto: number | null;
  };
  pedido: {
    IDPedido: number;
    NumeroPedido: string | null;
    estado: { codigo: string | null; nombre: string | null };
    FechaCreacion: string | null;
    DireccionEntrega: string | null;
    totales: {
      Subtotal: number | null;
      Descuento: number | null;
      CostoEnvio: number | null;
      Total: number | null;
      BaseImponible: number | null;
      IVA: number | null;
      PorcentajeIVA: number | null;
    };
    cupon: string | null;
    NombreFactura: string | null;
    NITFactura: string | null;
  } | null;
  lineas: unknown[];
}

/** Cabecera de GET /pedidos/:id (incluye el snapshot de facturacion). */
export interface PedidoCabecera {
  IDPedido: number;
  NumeroPedido: string;
  IDUsuario?: number;
  ClienteNombre?: string;
  ClienteCorreo?: string;
  EstadoCodigo: string;
  EstadoNombre: string;
  IDDireccion: number | null;
  DireccionEntrega: string;
  Subtotal: number;
  Descuento: number;
  CostoEnvio: number;
  Total: number;
  BaseImponible: number;
  IVA: number;
  PorcentajeIVA: number;
  IDCupon: number | null;
  CuponCodigo: string | null;
  NombreFactura: string | null;
  NITFactura: string | null;
  FechaCreacion: string;
  FechaActualizacion: string | null;
}

/** Linea del detalle de un pedido (GET /pedidos/:id, recordset de detalle). */
export interface PedidoLineaDetalle {
  IDPedidoDetalle: number;
  IDVariante: number;
  SKU: string;
  NombreProducto: string;
  DescripcionVariante: string | null;
  IDCategoria: number;
  Categoria: string | null;
  Cantidad: number;
  PrecioUnitario: number;
  DescuentoLinea: number;
  TotalLinea: number;
  /** PrecioUnitario * Cantidad (bruto de la linea), calculado en SQL. */
  SubtotalLinea: number;
  CantidadDevuelta: number;
  IDProducto: number | null;
  ProductoActivo: boolean | null;
  ImagenPrincipal: string | null;
}

/** Hito del historial de estados del pedido. */
export interface HistorialEstado {
  IDPedidoHistorialEstado: number;
  EstadoAnteriorCodigo: string | null;
  EstadoNuevoCodigo: string;
  EstadoNuevoNombre: string;
  IDUsuario: number;
  UsuarioNombre: string;
  Comentario: string | null;
  Fecha: string;
}

/** Linea de una devolucion del pedido. */
export interface DevolucionLineaPedido {
  IDDevolucionDetalle: number;
  IDDevolucion: number;
  IDPedidoDetalle: number;
  SKU: string;
  Cantidad: number;
  MontoLinea: number;
}

/** Devolucion del pedido con sus lineas. */
export interface DevolucionPedido {
  IDDevolucion: number;
  Motivo: string;
  MontoReintegrado: number;
  Fecha: string;
  IDUsuario: number;
  UsuarioNombre: string;
  lineas: DevolucionLineaPedido[];
}

/** Pago simulado del pedido (GET /pedidos/:id -> pago). */
export interface PagoPedido {
  IDPago: number;
  MetodoPago: string;
  Estado: string;
  Monto: number;
  Referencia: string;
  Fecha: string;
}

/** Respuesta de GET /pedidos/:id. */
export interface RespuestaPedido {
  pedido: PedidoCabecera;
  lineas: PedidoLineaDetalle[];
  historial: HistorialEstado[];
  devoluciones: DevolucionPedido[];
  pago: PagoPedido | null;
}

/** Fila de GET /pedidos (listado enriquecido del cliente, SP_Pedidos_ListarCliente). */
export interface PedidoListado {
  IDPedido: number;
  NumeroPedido: string;
  EstadoCodigo: string;
  EstadoNombre: string;
  Subtotal: number;
  Descuento: number;
  CostoEnvio: number;
  Total: number;
  IDCupon: number | null;
  CuponCodigo: string | null;
  FechaCreacion: string;
  FechaActualizacion: string | null;
  CantidadLineas: number;
  CantidadUnidades: number;
  UnidadesDevueltas: number;
  Img1: string | null;
  Img2: string | null;
  Img3: string | null;
  NombresResumen: string | null;
}

/** Respuesta de GET /pedidos (pagina). */
export interface PaginaPedidos {
  filas: PedidoListado[];
  total: number;
  pagina: number;
  tamanoPagina: number;
}

/** Filtros del listado de pedidos del cliente. */
export interface FiltrosPedidos {
  estado?: string;
  numero?: string;
  orden?: 'ASC' | 'DESC';
  pagina?: number;
  tamano?: number;
}

/** Respuesta de GET /pedidos/resumen (SP_Pedidos_ResumenCliente). */
export interface ResumenPedidos {
  Pagado: number;
  EnPreparacion: number;
  Despachado: number;
  Entregado: number;
  Cancelado: number;
  Devuelto: number;
  Total: number;
  TotalComprado: number;
  DespachadoNumero: string | null;
  DespachadoFechaEstimada: string | null;
  UltimoEntregadoFecha: string | null;
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

/* ------------------------------- Fase 2: Mi cuenta ------------------------- */

/** Perfil del usuario autenticado (GET /usuarios/me). */
export interface PerfilUsuario {
  IDUsuario: number;
  Correo: string;
  Nombre: string;
  Telefono: string | null;
  IDRol: number;
  Rol: Rol;
  FechaCreacion: string;
}

export interface PerfilInput {
  nombre: string;
  telefono?: string;
}

/* --------------------- Fase 2: administracion del catalogo ---------------- */

export type EstadoDerivado = 'publicado' | 'agotado' | 'incompleto' | 'oculto';

/** Fila del listado de administracion (SP_Catalogo_ListarAdmin). */
export interface ProductoAdminFila {
  IDProducto: number;
  Nombre: string;
  IDCategoria: number;
  Categoria: string;
  Activo: boolean;
  CategoriaActiva: boolean;
  PrecioMinimo: number | null;
  CantidadVariantes: number;
  CantidadVariantesActivas: number;
  /** Cuantas variantes del producto tienen imagen propia (ImagenURL). */
  VariantesConImagen: number;
  DisponibleTotal: number;
  BajoStock: boolean;
  ImagenPrincipal: string | null;
  SkusResumen: string | null;
  SkusTotal: number;
  EstadoDerivado: EstadoDerivado;
}

export interface ConteosCatalogo {
  Total: number;
  Publicados: number;
  Agotados: number;
  Incompletos: number;
  Ocultos: number;
  BajoStock: number;
  Variantes: number;
}

export interface PaginaAdmin {
  filas: ProductoAdminFila[];
  total: number;
  conteos: ConteosCatalogo | null;
  pagina: number;
  tamano: number;
}

export interface FiltrosAdmin {
  texto?: string;
  idCategoria?: number;
  estado?: EstadoDerivado | 'bajoStock';
  pagina: number;
  tamano: number;
}

/** Categoria con el total que agrega la Fase 2 (visibles / totales). */
export interface CategoriaAdmin extends Categoria {
  CantidadProductosTotal: number;
}

/** Cuerpos de escritura del catalogo (mismas reglas que los schemas de la API). */
export interface ProductoBody {
  idCategoria: number;
  nombre: string;
  descripcion?: string;
}
export interface VarianteBody {
  sku: string;
  precio: number;
  // La API espera los atributos en minuscula {nombre, valor} (atributoSchema).
  atributos: { nombre: string; valor: string }[];
  // F2: imagen propia. Ausente = no se toca; null = quitar; string = asignar.
  imagenURL?: string | null;
}

/** Respuesta de POST /archivos/imagenes. */
export interface ImagenSubida {
  url: string;
  bytes: number;
  tipo: string;
}

/* ----------------------- Fase 2: operacion (F7) --------------------------- */

/** Fila del tablero de inventario (SP_Inventario_ListarAdmin). */
export interface InventarioFila {
  IDVariante: number;
  SKU: string;
  IDProducto: number;
  Producto: string;
  IDCategoria: number;
  Categoria: string;
  Precio: number;
  Activo: boolean;
  Presentacion: string | null;
  Existencia: number;
  Reservado: number;
  Disponible: number;
  BajoStock: boolean;
  UltimoMovimientoFecha: string | null;
  UltimoMovimientoTipo: string | null;
  UltimoMovimientoNombre: string | null;
  UltimoMovimientoCantidad: number | null;
  UltimoMovimientoSigno: number | null;
  ImagenURL: string | null;
  ImagenPrincipal: string | null;
}

export interface PaginaInventario {
  filas: InventarioFila[];
  total: number;
  pagina: number;
  tamano: number;
}

export type FiltroInventario = 'bajoStock' | 'agotadas' | 'conReservas';

export interface FiltrosInventario {
  texto?: string;
  idCategoria?: number;
  idProducto?: number;
  filtro?: FiltroInventario;
  pagina: number;
  tamano: number;
}

/** KPIs del tablero de inventario (SP_Inventario_Resumen, recordset 1). */
export interface ResumenInventario {
  TotalVariantes: number;
  UnidadesDisponibles: number;
  UnidadesReservadas: number;
  VariantesBajoStock: number;
  VariantesAgotadas: number;
  VariantesConReservas: number;
  MovimientosHoy: number;
  Inconsistencias: number;
  UmbralBajoStock: number;
  ReservaMinutos: number;
}

export interface MovimientoHoy {
  CodigoTipo: string;
  NombreTipo: string;
  Signo: number;
  Cantidad: number;
}

export interface RespuestaResumenInventario {
  resumen: ResumenInventario | null;
  movimientosHoy: MovimientoHoy[];
}

/** Tipo de movimiento que el area interna puede registrar/simular. */
export type TipoMovimiento = 'ENTRADA_COMPRA' | 'AJUSTE_POSITIVO' | 'AJUSTE_NEGATIVO';

export interface SimularInput {
  idVariante: number;
  tipo: TipoMovimiento;
  cantidad: number;
}

/** Resultado de POST /inventario/simular (solo lectura). */
export interface SimulacionMovimiento {
  ExistenciaActual: number;
  Reservado: number;
  Disponible: number;
  ExistenciaResultante: number;
  DisponibleResultante: number;
  Permitido: boolean;
  Motivo: string | null;
}

/** Fila del kardex de una variante (SP_Inventario_ListarKardex). */
export interface KardexFila {
  IDKardex: number;
  Fecha: string;
  CodigoTipo: string;
  NombreTipo: string;
  Signo: number;
  Cantidad: number;
  ExistenciaResultante: number;
  Motivo: string | null;
  IDUsuario: number;
  Usuario: string | null;
  IDPedido: number | null;
  NumeroPedido: string | null;
}

export interface KardexResumen {
  IDVariante: number;
  SKU: string;
  Producto: string;
  Existencia: number;
  Reservado: number;
  Disponible: number;
}

export interface RespuestaKardex {
  resumen: KardexResumen | null;
  filas: KardexFila[];
  total: number;
  pagina: number;
  tamanoPagina: number;
}

/** Una variante inconsistente (SP_Inventario_VerificarConsistencia, recordset 1). */
export interface InconsistenciaInventario {
  IDVariante: number;
  SKU: string;
  Existencia: number;
  SumaKardex: number;
  Diferencia: number;
}

export interface ResultadoConsistencia {
  inconsistencias: InconsistenciaInventario[];
  totalVariantes: number;
  variantesInconsistentes: number;
  consistente: boolean;
}

/** Cuerpos de registro de movimiento (mismas reglas que inventario.schema). */
export interface EntradaBody {
  idVariante: number;
  cantidad: number;
  motivo: string;
}
export interface AjusteBody {
  idVariante: number;
  tipo: 'AJUSTE_POSITIVO' | 'AJUSTE_NEGATIVO';
  cantidad: number;
  motivo: string;
}

/** Resumen de operacion de pedidos (SP_Pedidos_ResumenOperacion). */
export interface ResumenOperacion {
  Pagado: number;
  EnPreparacion: number;
  Despachado: number;
  PorPreparar: number;
  EntregadoReciente: number;
  CanceladosRecientes: number;
  DevueltosRecientes: number;
  PagadoMasAntiguoMinutos: number | null;
}

/** Fila del listado de operacion (SP_Pedidos_ListarOperacion). */
export interface PedidoOperacionFila {
  IDPedido: number;
  NumeroPedido: string;
  IDUsuario: number;
  NombreCliente: string;
  ClienteCorreo: string;
  EstadoCodigo: string;
  EstadoNombre: string;
  Total: number;
  IDDireccion: number | null;
  Municipio: string | null;
  Departamento: string | null;
  FechaCreacion: string;
  FechaActualizacion: string | null;
  CantidadLineas: number;
  CantidadUnidades: number;
  MinutosEnEstado: number;
}

export interface PaginaPedidosOperacion {
  filas: PedidoOperacionFila[];
  total: number;
  pagina: number;
  tamanoPagina: number;
}

export interface FiltrosPedidosOperacion {
  estado?: string;
  texto?: string;
  desde?: string;
  hasta?: string;
  /** Ventana (dias) por ultima actualizacion para estados terminales; coincide con el resumen. */
  recienteDias?: number;
  pagina: number;
  tamanoPagina: number;
}
export interface ImagenBody {
  url: string;
  orden?: number;
  esPrincipal?: boolean;
}
