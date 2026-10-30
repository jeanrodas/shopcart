const errorResponse = {
  type: 'object',
  required: ['code', 'message', 'requestId'],
  properties: {
    code: { type: 'string', example: 'VALIDATION_ERROR' },
    message: { type: 'string', example: 'Datos de entrada invalidos' },
    details: {},
    requestId: { type: 'string', example: '4b1c9c2e-1a7e-4a9f-9a0e-2f3b5c6d7e8f' },
  },
};

const usuarioSchema = {
  type: 'object',
  properties: {
    IDUsuario: { type: 'integer', example: 3 },
    Correo: { type: 'string', example: 'cliente@shopcart.local' },
    Nombre: { type: 'string', example: 'Cliente ShopCart' },
    Activo: { type: 'boolean', example: true },
    IDRol: { type: 'integer', example: 1 },
    Rol: { type: 'string', example: 'Cliente' },
    FechaCreacion: { type: 'string', format: 'date-time' },
  },
};

const direccionSchema = {
  type: 'object',
  properties: {
    IDDireccion: { type: 'integer', example: 1 },
    IDUsuario: { type: 'integer', example: 3 },
    Alias: { type: 'string', example: 'Casa' },
    NombreReceptor: { type: 'string', example: 'Cliente ShopCart' },
    Telefono: { type: 'string', example: '+502 5555-0000' },
    Linea1: { type: 'string', example: '1a Calle 2-34 Zona 1' },
    Linea2: { type: 'string', nullable: true, example: null },
    Municipio: { type: 'string', example: 'Guatemala' },
    Departamento: { type: 'string', example: 'Guatemala' },
    CodigoPostal: { type: 'string', nullable: true, example: '01001' },
    Referencia: { type: 'string', nullable: true, example: 'Porton negro' },
    Activo: { type: 'boolean', example: true },
    FechaCreacion: { type: 'string', format: 'date-time' },
  },
};

const sesionResponse = {
  type: 'object',
  properties: {
    accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
    refreshToken: { type: 'string', example: 'a1b2c3d4e5f6...' },
    usuario: {
      type: 'object',
      properties: {
        id: { type: 'integer', example: 3 },
        correo: { type: 'string', example: 'cliente@shopcart.local' },
        nombre: { type: 'string', example: 'Cliente ShopCart' },
        rol: { type: 'string', example: 'Cliente' },
      },
    },
  },
};

const carritoFusionadoSchema = {
  type: 'object',
  nullable: true,
  properties: {
    lineas: { type: 'integer', description: 'Cantidad de lineas del carrito tras fusionar', example: 2 },
    advertencias: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          IDVariante: { type: 'integer', example: 2 },
          SKU: { type: 'string', example: 'LUB-SIN-5W30-GAL' },
          CantidadSolicitada: { type: 'integer', example: 8 },
          CantidadFinal: { type: 'integer', example: 5 },
          Motivo: { type: 'string', example: 'Cantidad ajustada al disponible (5)' },
        },
      },
    },
  },
};

const sesionConCarrito = {
  allOf: [
    sesionResponse,
    { type: 'object', properties: { carritoFusionado: carritoFusionadoSchema } },
  ],
};

const categoriaSchema = {
  type: 'object',
  properties: {
    IDCategoria: { type: 'integer', example: 1 },
    Nombre: { type: 'string', example: 'Camisas' },
    Descripcion: { type: 'string', nullable: true, example: 'Camisas formales y casuales' },
    Activo: { type: 'boolean', example: true },
    FechaCreacion: { type: 'string', format: 'date-time' },
    CantidadProductosActivos: { type: 'integer', example: 3 },
  },
};

const productoResumenSchema = {
  type: 'object',
  properties: {
    IDProducto: { type: 'integer', example: 1 },
    Nombre: { type: 'string', example: 'Camisa Oxford Clasica' },
    Descripcion: { type: 'string', nullable: true },
    IDCategoria: { type: 'integer', example: 1 },
    Categoria: { type: 'string', example: 'Camisas' },
    Activo: { type: 'boolean', example: true },
    FechaCreacion: { type: 'string', format: 'date-time' },
    PrecioMinimo: { type: 'number', nullable: true, example: 149.0 },
    PrecioMaximo: { type: 'number', nullable: true, example: 149.0 },
    VariantesActivas: { type: 'integer', example: 2 },
    HayDisponible: { type: 'boolean', example: false },
    ImagenPrincipal: { type: 'string', nullable: true, example: 'https://picsum.photos/seed/CAM-OXF/600/600' },
  },
};

const varianteSchema = {
  type: 'object',
  properties: {
    IDVariante: { type: 'integer', example: 1 },
    SKU: { type: 'string', example: 'CAM-OXF-S-BLA' },
    Precio: { type: 'number', example: 149.0 },
    Activo: { type: 'boolean', example: true },
    Existencia: { type: 'integer', example: 0 },
    Reservado: { type: 'integer', example: 0 },
    Disponible: { type: 'integer', example: 0 },
    atributos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          Nombre: { type: 'string', example: 'Talla' },
          Valor: { type: 'string', example: 'S' },
        },
      },
    },
  },
};

const productoDetalleSchema = {
  type: 'object',
  properties: {
    producto: {
      type: 'object',
      properties: {
        IDProducto: { type: 'integer', example: 1 },
        IDCategoria: { type: 'integer', example: 1 },
        Categoria: { type: 'string', example: 'Camisas' },
        Nombre: { type: 'string', example: 'Camisa Oxford Clasica' },
        Descripcion: { type: 'string', nullable: true },
        Activo: { type: 'boolean', example: true },
        FechaCreacion: { type: 'string', format: 'date-time' },
        FechaActualizacion: { type: 'string', format: 'date-time', nullable: true },
      },
    },
    variantes: { type: 'array', items: varianteSchema },
    imagenes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          IDProductoImagen: { type: 'integer', example: 1 },
          IDProducto: { type: 'integer', example: 1 },
          Url: { type: 'string', example: 'https://picsum.photos/seed/CAM-OXF/600/600' },
          Orden: { type: 'integer', example: 0 },
          EsPrincipal: { type: 'boolean', example: true },
        },
      },
    },
  },
};

const varianteBody = {
  type: 'object',
  required: ['sku', 'precio'],
  properties: {
    sku: { type: 'string', maxLength: 50, example: 'CAM-OXF-XL-BLA' },
    precio: { type: 'number', example: 149.0 },
    atributos: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        required: ['nombre', 'valor'],
        properties: {
          nombre: { type: 'string', example: 'Talla' },
          valor: { type: 'string', example: 'XL' },
        },
      },
    },
  },
};

const movimientoKardexSchema = {
  type: 'object',
  properties: {
    IDKardex: { type: 'integer', example: 101 },
    IDVariante: { type: 'integer', example: 1 },
    CodigoTipo: { type: 'string', example: 'ENTRADA_COMPRA' },
    NombreTipo: { type: 'string', example: 'Entrada por compra' },
    Signo: { type: 'integer', example: 1 },
    Cantidad: { type: 'integer', example: 10 },
    ExistenciaResultante: { type: 'integer', example: 25 },
    Motivo: { type: 'string', example: 'Reposicion de stock' },
    IDUsuario: { type: 'integer', example: 1 },
    IDPedido: { type: 'integer', nullable: true, example: null },
    Fecha: { type: 'string', format: 'date-time' },
    Existencia: { type: 'integer', example: 25 },
    Reservado: { type: 'integer', example: 0 },
    Disponible: { type: 'integer', example: 25 },
  },
};

const existenciaSchema = {
  type: 'object',
  properties: {
    IDVariante: { type: 'integer', example: 1 },
    SKU: { type: 'string', example: 'LUB-SIN-5W30-1QT' },
    IDProducto: { type: 'integer', example: 1 },
    Producto: { type: 'string', example: 'Aceite Sintetico Motor' },
    IDCategoria: { type: 'integer', example: 1 },
    Categoria: { type: 'string', example: 'Lubricantes' },
    Precio: { type: 'number', example: 85.0 },
    Activo: { type: 'boolean', example: true },
    Existencia: { type: 'integer', example: 25 },
    Reservado: { type: 'integer', example: 0 },
    Disponible: { type: 'integer', example: 25 },
    UltimoMovimiento: { type: 'string', format: 'date-time', nullable: true },
    BajoStock: { type: 'boolean', example: false },
  },
};

const consistenciaSchema = {
  type: 'object',
  properties: {
    inconsistencias: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          IDVariante: { type: 'integer' },
          SKU: { type: 'string' },
          Existencia: { type: 'integer' },
          SumaKardex: { type: 'integer' },
          Diferencia: { type: 'integer' },
        },
      },
    },
    totalVariantes: { type: 'integer', example: 22 },
    variantesInconsistentes: { type: 'integer', example: 0 },
    consistente: { type: 'boolean', example: true },
  },
};

const carritoLineaSchema = {
  type: 'object',
  properties: {
    IDCarritoDetalle: { type: 'integer', example: 10 },
    IDVariante: { type: 'integer', example: 2 },
    SKU: { type: 'string', example: 'LUB-SIN-5W30-GAL' },
    IDProducto: { type: 'integer', example: 1 },
    Producto: { type: 'string', example: 'Aceite Sintetico Motor' },
    Categoria: { type: 'string', example: 'Lubricantes' },
    ImagenPrincipal: { type: 'string', nullable: true, example: 'https://picsum.photos/seed/LUB-SIN/600/600' },
    Cantidad: { type: 'integer', example: 2 },
    PrecioUnitario: { type: 'number', example: 320.0 },
    TotalLinea: { type: 'number', example: 640.0 },
    Disponible: { type: 'integer', example: 5 },
    VarianteActiva: { type: 'boolean', example: true },
    Advertencia: { type: 'string', nullable: true, example: null },
  },
};

const carritoSchema = {
  type: 'object',
  properties: {
    carrito: {
      type: 'object',
      properties: {
        IDCarrito: { type: 'integer', nullable: true, example: 1 },
        TokenInvitado: { type: 'string', nullable: true, example: null },
        Estado: { type: 'string', nullable: true, example: 'Activo' },
        FechaUltimaActividad: { type: 'string', format: 'date-time', nullable: true },
        totales: {
          type: 'object',
          properties: {
            Subtotal: { type: 'number', example: 960.0 },
            Descuento: { type: 'number', example: 0.0 },
            Total: { type: 'number', example: 960.0 },
            PorcentajeIVA: { type: 'number', example: 12.0 },
            BaseImponible: { type: 'number', example: 857.14 },
            IVA: { type: 'number', example: 102.86 },
            CantidadLineas: { type: 'integer', example: 2 },
            CantidadUnidades: { type: 'integer', example: 3 },
          },
        },
      },
    },
    lineas: { type: 'array', items: carritoLineaSchema },
    cupon: {
      type: 'object',
      nullable: true,
      description:
        'Cupon aplicado (M5). null si el carrito no tiene cupon. El descuento se ' +
        'recalcula al mostrar: si el cupon dejo de ser valido, descuento.valido = false, ' +
        'descuento.causa explica el motivo y descuento.descuento = 0.',
      properties: {
        IDCupon: { type: 'integer', example: 1 },
        Codigo: { type: 'string', example: 'PROMO10' },
        TipoDescuento: { type: 'string', enum: ['PORCENTAJE', 'MONTO'], example: 'PORCENTAJE' },
        Valor: { type: 'number', example: 10.0 },
        Categoria: { type: 'string', nullable: true, example: null },
        descuento: {
          type: 'object',
          properties: {
            baseElegible: { type: 'number', example: 960.0 },
            descuento: { type: 'number', example: 96.0 },
            valido: { type: 'boolean', example: true },
            causa: { type: 'string', nullable: true, example: null },
          },
        },
      },
    },
    cartToken: { type: 'string', description: 'Solo al crear el carrito de invitado', example: '11111111-1111-1111-1111-111111111111' },
  },
};

const cuponSchema = {
  type: 'object',
  properties: {
    IDCupon: { type: 'integer', example: 1 },
    Codigo: { type: 'string', example: 'PROMO10' },
    TipoDescuento: { type: 'string', enum: ['PORCENTAJE', 'MONTO'], example: 'PORCENTAJE' },
    Valor: { type: 'number', example: 10.0 },
    IDCategoria: { type: 'integer', nullable: true, example: null },
    Categoria: { type: 'string', nullable: true, example: null },
    MontoMinimo: { type: 'number', example: 0.0 },
    FechaInicio: { type: 'string', format: 'date-time' },
    FechaFin: { type: 'string', format: 'date-time' },
    LimiteUsosTotal: { type: 'integer', nullable: true, example: null },
    LimiteUsosPorCliente: { type: 'integer', nullable: true, example: null },
    UsosActuales: { type: 'integer', example: 0 },
    Activo: { type: 'boolean', example: true },
    FechaCreacion: { type: 'string', format: 'date-time' },
    FechaActualizacion: { type: 'string', format: 'date-time', nullable: true },
    UsosRegistrados: { type: 'integer', description: 'Conteo real en CuponUso', example: 0 },
  },
};

const cuponBody = {
  type: 'object',
  required: ['codigo', 'tipoDescuento', 'valor', 'fechaInicio', 'fechaFin'],
  properties: {
    codigo: { type: 'string', minLength: 3, maxLength: 30, example: 'PROMO10', description: 'Letras, numeros y guion; se normaliza a mayusculas' },
    tipoDescuento: { type: 'string', enum: ['PORCENTAJE', 'MONTO'], example: 'PORCENTAJE' },
    valor: { type: 'number', example: 10.0, description: 'Si es PORCENTAJE, <= 100' },
    idCategoria: { type: 'integer', nullable: true, example: null, description: 'Limita la base elegible a esa categoria' },
    montoMinimo: { type: 'number', example: 0.0, default: 0 },
    fechaInicio: { type: 'string', format: 'date-time' },
    fechaFin: { type: 'string', format: 'date-time', description: 'Posterior a fechaInicio' },
    limiteUsosTotal: { type: 'integer', nullable: true, example: null },
    limiteUsosPorCliente: { type: 'integer', nullable: true, example: null },
  },
};

const checkoutResumenSchema = {
  type: 'object',
  properties: {
    resumen: {
      type: 'object',
      nullable: true,
      description: 'null cuando el carrito esta vacio',
      properties: {
        IDCarrito: { type: 'integer', example: 7 },
        IDDireccion: { type: 'integer', nullable: true, example: 3 },
        DireccionTexto: { type: 'string', nullable: true, example: 'Cliente ShopCart, +502 5555-0000, 1a Calle 2-34 Zona 1, Guatemala, Guatemala' },
        totales: {
          type: 'object',
          properties: {
            Subtotal: { type: 'number', example: 350.0 },
            Descuento: { type: 'number', example: 50.0 },
            Total: { type: 'number', example: 300.0 },
            PorcentajeIVA: { type: 'number', example: 12.0 },
            BaseImponible: { type: 'number', example: 267.86 },
            IVA: { type: 'number', example: 32.14 },
            CantidadLineas: { type: 'integer', example: 1 },
            CantidadUnidades: { type: 'integer', example: 1 },
          },
        },
        CostoEnvio: { type: 'number', example: 0.0 },
        TotalConEnvio: { type: 'number', example: 300.0 },
        ExpiraEn: { type: 'string', format: 'date-time', nullable: true },
        Minutos: { type: 'integer', example: 15 },
        ReservaActiva: { type: 'boolean', example: true, description: 'Solo en GET /checkout/resumen' },
      },
    },
    lineas: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          IDVariante: { type: 'integer', example: 2 },
          SKU: { type: 'string', example: 'LUB-SIN-5W30-GAL' },
          Cantidad: { type: 'integer', example: 1 },
          FechaExpira: { type: 'string', format: 'date-time' },
        },
      },
    },
  },
};

const pedidoLineaSchema = {
  type: 'object',
  properties: {
    IDPedidoDetalle: { type: 'integer', example: 10 },
    IDVariante: { type: 'integer', example: 2 },
    SKU: { type: 'string', example: 'LUB-SIN-5W30-GAL' },
    NombreProducto: { type: 'string', example: 'Aceite sintetico 5W30' },
    DescripcionVariante: { type: 'string', nullable: true, example: 'Presentacion: Galon' },
    IDCategoria: { type: 'integer', example: 4 },
    Cantidad: { type: 'integer', example: 1 },
    PrecioUnitario: { type: 'number', example: 350.0 },
    DescuentoLinea: { type: 'number', example: 50.0 },
    TotalLinea: { type: 'number', example: 300.0 },
  },
};

const pagoResultadoSchema = {
  type: 'object',
  properties: {
    aprobado: { type: 'boolean', example: true },
    replay: { type: 'boolean', example: false, description: 'true si se devolvio un resultado previo (idempotencia)' },
    pago: {
      type: 'object',
      properties: {
        IDPago: { type: 'integer', example: 5 },
        Estado: { type: 'string', enum: ['Aprobado', 'Rechazado'], example: 'Aprobado' },
        MensajeResultado: { type: 'string', nullable: true, example: 'Pago aprobado (simulado)' },
        ClaveIdempotencia: { type: 'string', example: 'c0ffee00-1234-4567-89ab-cdef01234567' },
        Monto: { type: 'number', nullable: true, example: 300.0 },
      },
    },
    pedido: {
      type: 'object',
      nullable: true,
      description: 'null cuando el pago fue rechazado',
      properties: {
        IDPedido: { type: 'integer', example: 1 },
        NumeroPedido: { type: 'string', example: 'SC-000001' },
        estado: {
          type: 'object',
          properties: {
            codigo: { type: 'string', example: 'PAGADO' },
            nombre: { type: 'string', example: 'Pagado' },
          },
        },
        FechaCreacion: { type: 'string', format: 'date-time' },
        DireccionEntrega: { type: 'string', example: 'Cliente ShopCart, +502 5555-0000, 1a Calle 2-34 Zona 1, Guatemala, Guatemala' },
        totales: {
          type: 'object',
          properties: {
            Subtotal: { type: 'number', example: 350.0 },
            Descuento: { type: 'number', example: 50.0 },
            CostoEnvio: { type: 'number', example: 0.0 },
            Total: { type: 'number', example: 300.0 },
            BaseImponible: { type: 'number', example: 267.86 },
            IVA: { type: 'number', example: 32.14 },
            PorcentajeIVA: { type: 'number', example: 12.0 },
          },
        },
        cupon: { type: 'string', nullable: true, example: 'LUB50' },
      },
    },
    lineas: { type: 'array', items: pedidoLineaSchema },
  },
};

const errRef = { $ref: '#/components/responses/Error' };

const jsonBody = (schema: unknown) => ({ content: { 'application/json': { schema } } });

export const openapiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'ShopCart API',
    version: '1.0.0',
    description: 'API de la plataforma de e-commerce ShopCart.',
  },
  servers: [{ url: '/', description: 'Servidor actual' }],
  tags: [
    { name: 'Sistema', description: 'Endpoints de infraestructura y salud' },
    { name: 'Auth', description: 'Autenticacion y sesion' },
    { name: 'Usuarios', description: 'Gestion de usuarios (Administrador)' },
    { name: 'Direcciones', description: 'Direcciones del usuario autenticado' },
    { name: 'Catalogo', description: 'Lectura publica del catalogo (sin token)' },
    { name: 'Categorias', description: 'Gestion de categorias (Administrador/Operador)' },
    { name: 'Productos', description: 'Gestion de productos (Administrador/Operador)' },
    { name: 'Variantes', description: 'Gestion de variantes (Administrador)' },
    { name: 'Imagenes', description: 'Imagenes de producto (Administrador)' },
    { name: 'Inventario', description: 'Existencias, movimientos y kardex (Operador/Administrador)' },
    { name: 'Carrito', description: 'Carrito de compras del cliente o del invitado (RF-04)' },
    { name: 'Cupones', description: 'Cupones y promociones: gestion (Administrador) y aplicacion al carrito (Cliente) (RF-05)' },
    { name: 'Checkout', description: 'Checkout y pago: reserva de existencia, pago simulado idempotente y creacion de pedido (RF-06)' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      cartToken: {
        type: 'apiKey',
        in: 'header',
        name: 'X-Cart-Token',
        description:
          'Token (UUID) del carrito de invitado. Opcional: si no hay Bearer y no se ' +
          'envia, el primer POST /carrito/items crea el carrito y devuelve el token ' +
          'en el header y en el cuerpo (cartToken). Se ignora si hay Bearer de Cliente.',
      },
    },
    responses: {
      Error: {
        description: 'Error. El codigo HTTP indica el tipo (400 validacion, 401 no autenticado, 403 prohibido, 404 no encontrado, 409 conflicto, 429 rate limit).',
        content: { 'application/json': { schema: errorResponse } },
      },
    },
    schemas: {
      ErrorResponse: errorResponse,
      Usuario: usuarioSchema,
      Direccion: direccionSchema,
      SesionResponse: sesionResponse,
      Categoria: categoriaSchema,
      ProductoResumen: productoResumenSchema,
      ProductoDetalle: productoDetalleSchema,
      Variante: varianteSchema,
      MovimientoKardex: movimientoKardexSchema,
      Existencia: existenciaSchema,
      Consistencia: consistenciaSchema,
      CarritoLinea: carritoLineaSchema,
      Carrito: carritoSchema,
      Cupon: cuponSchema,
      CheckoutResumen: checkoutResumenSchema,
      PagoResultado: pagoResultadoSchema,
      PedidoLinea: pedidoLineaSchema,
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Sistema'],
        summary: 'Estado del servicio',
        description:
          'Devuelve el estado del servicio y de la conexion a la base de datos. ' +
          'Responde 200 incluso si la base de datos no esta disponible (db = "error").',
        responses: {
          '200': {
            description: 'Servicio operativo',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status', 'db', 'timestamp'],
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    db: { type: 'string', enum: ['ok', 'error'], example: 'ok' },
                    timestamp: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },

    '/api/v1/auth/registro': {
      post: {
        tags: ['Auth'],
        summary: 'Registro de cliente',
        description:
          'Acepta el header opcional X-Cart-Token (UUID). Si viene, tras registrar se ' +
          'fusiona el carrito de invitado en el del nuevo usuario y la respuesta incluye ' +
          'carritoFusionado; si no, carritoFusionado es null.',
        parameters: [
          { name: 'X-Cart-Token', in: 'header', required: false, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          ...jsonBody({
            type: 'object',
            required: ['correo', 'contrasena', 'nombre'],
            properties: {
              correo: { type: 'string', format: 'email', example: 'nuevo@shopcart.local' },
              contrasena: { type: 'string', minLength: 8, example: 'Cliente123!' },
              nombre: { type: 'string', example: 'Nuevo Cliente' },
            },
          }),
        },
        responses: {
          '201': { description: 'Cliente registrado', ...jsonBody(sesionConCarrito) },
          '400': errRef,
          '409': errRef,
          '429': errRef,
        },
      },
    },

    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Inicio de sesion',
        description:
          'Acepta el header opcional X-Cart-Token (UUID). Si viene, tras autenticar se ' +
          'fusiona el carrito de invitado en el del usuario (topando cada cantidad al ' +
          'disponible) y la respuesta incluye carritoFusionado; si no, es null.',
        parameters: [
          { name: 'X-Cart-Token', in: 'header', required: false, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: {
          required: true,
          ...jsonBody({
            type: 'object',
            required: ['correo', 'contrasena'],
            properties: {
              correo: { type: 'string', format: 'email', example: 'cliente@shopcart.local' },
              contrasena: { type: 'string', example: 'Cliente123!' },
            },
          }),
        },
        responses: {
          '200': { description: 'Sesion iniciada', ...jsonBody(sesionConCarrito) },
          '400': errRef,
          '401': errRef,
          '429': errRef,
        },
      },
    },

    '/api/v1/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Rotacion de refresh token',
        requestBody: {
          required: true,
          ...jsonBody({
            type: 'object',
            required: ['refreshToken'],
            properties: { refreshToken: { type: 'string', example: 'a1b2c3d4e5f6...' } },
          }),
        },
        responses: {
          '200': { description: 'Nuevo par de tokens', ...jsonBody(sesionResponse) },
          '400': errRef,
          '401': errRef,
          '429': errRef,
        },
      },
    },

    '/api/v1/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'Cierre de sesion (revoca el refresh token)',
        requestBody: {
          required: true,
          ...jsonBody({
            type: 'object',
            required: ['refreshToken'],
            properties: { refreshToken: { type: 'string', example: 'a1b2c3d4e5f6...' } },
          }),
        },
        responses: {
          '200': {
            description: 'Sesion cerrada (idempotente)',
            ...jsonBody({ type: 'object', properties: { ok: { type: 'boolean', example: true } } }),
          },
          '400': errRef,
        },
      },
    },

    '/api/v1/auth/yo': {
      get: {
        tags: ['Auth'],
        summary: 'Perfil del usuario autenticado',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Perfil', ...jsonBody(usuarioSchema) },
          '401': errRef,
          '404': errRef,
        },
      },
    },

    '/api/v1/usuarios': {
      get: {
        tags: ['Usuarios'],
        summary: 'Listado paginado de usuarios',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'pagina', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'tamanoPagina', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
          { name: 'texto', in: 'query', schema: { type: 'string' } },
          { name: 'idRol', in: 'query', schema: { type: 'integer' } },
          { name: 'activo', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
          { name: 'orden', in: 'query', schema: { type: 'string', enum: ['Nombre', 'Correo', 'FechaCreacion'] } },
          { name: 'direccion', in: 'query', schema: { type: 'string', enum: ['ASC', 'DESC'] } },
        ],
        responses: {
          '200': {
            description: 'Pagina de usuarios',
            ...jsonBody({
              type: 'object',
              properties: {
                filas: { type: 'array', items: usuarioSchema },
                total: { type: 'integer', example: 3 },
                pagina: { type: 'integer', example: 1 },
                tamanoPagina: { type: 'integer', example: 20 },
              },
            }),
          },
          '400': errRef,
          '401': errRef,
          '403': errRef,
        },
      },
      post: {
        tags: ['Usuarios'],
        summary: 'Crear usuario (Operador/Administrador/Cliente)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          ...jsonBody({
            type: 'object',
            required: ['correo', 'contrasena', 'nombre', 'idRol'],
            properties: {
              correo: { type: 'string', format: 'email', example: 'nuevo.operador@shopcart.local' },
              contrasena: { type: 'string', example: 'Operador123!' },
              nombre: { type: 'string', example: 'Nuevo Operador' },
              idRol: { type: 'integer', example: 2 },
            },
          }),
        },
        responses: {
          '201': { description: 'Usuario creado', ...jsonBody(usuarioSchema) },
          '400': errRef,
          '401': errRef,
          '403': errRef,
          '409': errRef,
        },
      },
    },

    '/api/v1/usuarios/{id}/rol': {
      patch: {
        tags: ['Usuarios'],
        summary: 'Cambiar el rol de un usuario',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          ...jsonBody({
            type: 'object',
            required: ['idRol'],
            properties: { idRol: { type: 'integer', example: 2 } },
          }),
        },
        responses: {
          '200': { description: 'Usuario actualizado', ...jsonBody(usuarioSchema) },
          '400': errRef,
          '401': errRef,
          '403': errRef,
          '404': errRef,
          '409': errRef,
        },
      },
    },

    '/api/v1/usuarios/{id}/estado': {
      patch: {
        tags: ['Usuarios'],
        summary: 'Activar o desactivar un usuario',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          ...jsonBody({
            type: 'object',
            required: ['activo'],
            properties: { activo: { type: 'boolean', example: false } },
          }),
        },
        responses: {
          '200': { description: 'Usuario actualizado', ...jsonBody(usuarioSchema) },
          '400': errRef,
          '401': errRef,
          '403': errRef,
          '404': errRef,
          '409': errRef,
        },
      },
    },

    '/api/v1/direcciones': {
      get: {
        tags: ['Direcciones'],
        summary: 'Listar mis direcciones activas',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Direcciones del usuario',
            ...jsonBody({ type: 'array', items: direccionSchema }),
          },
          '401': errRef,
        },
      },
      post: {
        tags: ['Direcciones'],
        summary: 'Crear una direccion',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, ...jsonBody(direccionSchema) },
        responses: {
          '201': { description: 'Direccion creada', ...jsonBody(direccionSchema) },
          '400': errRef,
          '401': errRef,
        },
      },
    },

    '/api/v1/direcciones/{id}': {
      get: {
        tags: ['Direcciones'],
        summary: 'Obtener una direccion propia',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          '200': { description: 'Direccion', ...jsonBody(direccionSchema) },
          '401': errRef,
          '403': errRef,
          '404': errRef,
        },
      },
      put: {
        tags: ['Direcciones'],
        summary: 'Actualizar una direccion propia',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, ...jsonBody(direccionSchema) },
        responses: {
          '200': { description: 'Direccion actualizada', ...jsonBody(direccionSchema) },
          '400': errRef,
          '401': errRef,
          '403': errRef,
          '404': errRef,
        },
      },
      delete: {
        tags: ['Direcciones'],
        summary: 'Desactivar (baja logica) una direccion propia',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          '200': {
            description: 'Direccion desactivada',
            ...jsonBody({ type: 'object', properties: { ok: { type: 'boolean', example: true } } }),
          },
          '401': errRef,
          '403': errRef,
          '404': errRef,
        },
      },
    },

    '/api/v1/catalogo/categorias': {
      get: {
        tags: ['Catalogo'],
        summary: 'Listar categorias activas (publico)',
        responses: {
          '200': { description: 'Categorias activas', ...jsonBody({ type: 'array', items: categoriaSchema }) },
        },
      },
    },

    '/api/v1/catalogo/productos': {
      get: {
        tags: ['Catalogo'],
        summary: 'Buscar productos visibles en tienda (publico)',
        parameters: [
          { name: 'texto', in: 'query', schema: { type: 'string', maxLength: 100 } },
          { name: 'idCategoria', in: 'query', schema: { type: 'integer' } },
          { name: 'precioMin', in: 'query', schema: { type: 'number' } },
          { name: 'precioMax', in: 'query', schema: { type: 'number' } },
          { name: 'soloDisponibles', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
          { name: 'orden', in: 'query', schema: { type: 'string', enum: ['Nombre', 'Precio', 'FechaCreacion'] } },
          { name: 'direccion', in: 'query', schema: { type: 'string', enum: ['ASC', 'DESC'] } },
          { name: 'pagina', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'tamanoPagina', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
        ],
        responses: {
          '200': {
            description: 'Pagina de productos',
            ...jsonBody({
              type: 'object',
              properties: {
                filas: { type: 'array', items: productoResumenSchema },
                total: { type: 'integer', example: 12 },
                pagina: { type: 'integer', example: 1 },
                tamanoPagina: { type: 'integer', example: 20 },
              },
            }),
          },
          '400': errRef,
        },
      },
    },

    '/api/v1/catalogo/productos/{id}': {
      get: {
        tags: ['Catalogo'],
        summary: 'Detalle de producto visible en tienda (publico)',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          '200': { description: 'Producto con variantes, atributos e imagenes', ...jsonBody(productoDetalleSchema) },
          '404': errRef,
        },
      },
    },

    '/api/v1/categorias': {
      get: {
        tags: ['Categorias'],
        summary: 'Listar categorias (incluye inactivas opcionalmente)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'incluirInactivas', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } }],
        responses: {
          '200': { description: 'Categorias', ...jsonBody({ type: 'array', items: categoriaSchema }) },
          '401': errRef,
          '403': errRef,
        },
      },
      post: {
        tags: ['Categorias'],
        summary: 'Crear categoria',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          ...jsonBody({
            type: 'object',
            required: ['nombre'],
            properties: {
              nombre: { type: 'string', maxLength: 100, example: 'Zapatos' },
              descripcion: { type: 'string', maxLength: 300, example: 'Calzado formal' },
            },
          }),
        },
        responses: {
          '201': { description: 'Categoria creada', ...jsonBody(categoriaSchema) },
          '400': errRef,
          '401': errRef,
          '403': errRef,
          '409': errRef,
        },
      },
    },

    '/api/v1/categorias/{id}': {
      put: {
        tags: ['Categorias'],
        summary: 'Actualizar categoria',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          ...jsonBody({
            type: 'object',
            required: ['nombre'],
            properties: {
              nombre: { type: 'string', maxLength: 100 },
              descripcion: { type: 'string', maxLength: 300 },
            },
          }),
        },
        responses: {
          '200': { description: 'Categoria actualizada', ...jsonBody(categoriaSchema) },
          '400': errRef,
          '401': errRef,
          '403': errRef,
          '404': errRef,
          '409': errRef,
        },
      },
    },

    '/api/v1/categorias/{id}/estado': {
      patch: {
        tags: ['Categorias'],
        summary: 'Activar o desactivar una categoria',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          ...jsonBody({ type: 'object', required: ['activo'], properties: { activo: { type: 'boolean', example: false } } }),
        },
        responses: {
          '200': { description: 'Categoria actualizada', ...jsonBody(categoriaSchema) },
          '400': errRef,
          '401': errRef,
          '403': errRef,
          '404': errRef,
        },
      },
    },

    '/api/v1/productos': {
      get: {
        tags: ['Productos'],
        summary: 'Buscar productos (admin/operador, acepta incluirInactivos)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'texto', in: 'query', schema: { type: 'string', maxLength: 100 } },
          { name: 'idCategoria', in: 'query', schema: { type: 'integer' } },
          { name: 'precioMin', in: 'query', schema: { type: 'number' } },
          { name: 'precioMax', in: 'query', schema: { type: 'number' } },
          { name: 'soloDisponibles', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
          { name: 'incluirInactivos', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
          { name: 'orden', in: 'query', schema: { type: 'string', enum: ['Nombre', 'Precio', 'FechaCreacion'] } },
          { name: 'direccion', in: 'query', schema: { type: 'string', enum: ['ASC', 'DESC'] } },
          { name: 'pagina', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'tamanoPagina', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
        ],
        responses: {
          '200': {
            description: 'Pagina de productos',
            ...jsonBody({
              type: 'object',
              properties: {
                filas: { type: 'array', items: productoResumenSchema },
                total: { type: 'integer', example: 13 },
                pagina: { type: 'integer', example: 1 },
                tamanoPagina: { type: 'integer', example: 20 },
              },
            }),
          },
          '400': errRef,
          '401': errRef,
          '403': errRef,
        },
      },
      post: {
        tags: ['Productos'],
        summary: 'Crear producto',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          ...jsonBody({
            type: 'object',
            required: ['idCategoria', 'nombre'],
            properties: {
              idCategoria: { type: 'integer', example: 1 },
              nombre: { type: 'string', maxLength: 200, example: 'Camisa Nueva' },
              descripcion: { type: 'string', example: 'Descripcion del producto' },
            },
          }),
        },
        responses: {
          '201': { description: 'Producto creado', ...jsonBody(productoResumenSchema) },
          '400': errRef,
          '401': errRef,
          '403': errRef,
        },
      },
    },

    '/api/v1/productos/{id}': {
      get: {
        tags: ['Productos'],
        summary: 'Detalle de producto (admin/operador, acepta incluirInactivos)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'incluirInactivos', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
        ],
        responses: {
          '200': { description: 'Producto', ...jsonBody(productoDetalleSchema) },
          '401': errRef,
          '403': errRef,
          '404': errRef,
        },
      },
      put: {
        tags: ['Productos'],
        summary: 'Actualizar producto',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          ...jsonBody({
            type: 'object',
            required: ['idCategoria', 'nombre'],
            properties: {
              idCategoria: { type: 'integer' },
              nombre: { type: 'string', maxLength: 200 },
              descripcion: { type: 'string' },
            },
          }),
        },
        responses: {
          '200': { description: 'Producto actualizado', ...jsonBody(productoResumenSchema) },
          '400': errRef,
          '401': errRef,
          '403': errRef,
          '404': errRef,
        },
      },
    },

    '/api/v1/productos/{id}/estado': {
      patch: {
        tags: ['Productos'],
        summary: 'Activar o desactivar un producto',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          ...jsonBody({ type: 'object', required: ['activo'], properties: { activo: { type: 'boolean', example: false } } }),
        },
        responses: {
          '200': {
            description: 'Producto actualizado (incluye TieneVentas)',
            ...jsonBody({
              allOf: [productoResumenSchema, { type: 'object', properties: { TieneVentas: { type: 'boolean', example: false } } }],
            }),
          },
          '400': errRef,
          '401': errRef,
          '403': errRef,
          '404': errRef,
        },
      },
    },

    '/api/v1/productos/{id}/variantes': {
      post: {
        tags: ['Variantes'],
        summary: 'Crear una variante del producto',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, ...jsonBody(varianteBody) },
        responses: {
          '201': {
            description: 'Variante creada',
            ...jsonBody({ type: 'object', properties: { variante: varianteSchema, atributos: { type: 'array', items: { type: 'object' } } } }),
          },
          '400': errRef,
          '401': errRef,
          '403': errRef,
          '404': errRef,
          '409': errRef,
          '422': errRef,
        },
      },
    },

    '/api/v1/variantes/{id}': {
      put: {
        tags: ['Variantes'],
        summary: 'Actualizar una variante (reemplaza sus atributos)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, ...jsonBody(varianteBody) },
        responses: {
          '200': {
            description: 'Variante actualizada',
            ...jsonBody({ type: 'object', properties: { variante: varianteSchema, atributos: { type: 'array', items: { type: 'object' } } } }),
          },
          '400': errRef,
          '401': errRef,
          '403': errRef,
          '404': errRef,
          '409': errRef,
        },
      },
    },

    '/api/v1/variantes/{id}/estado': {
      patch: {
        tags: ['Variantes'],
        summary: 'Activar o desactivar una variante',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          ...jsonBody({ type: 'object', required: ['activo'], properties: { activo: { type: 'boolean', example: false } } }),
        },
        responses: {
          '200': { description: 'Variante actualizada', ...jsonBody(varianteSchema) },
          '400': errRef,
          '401': errRef,
          '403': errRef,
          '404': errRef,
        },
      },
    },

    '/api/v1/productos/{id}/imagenes': {
      post: {
        tags: ['Imagenes'],
        summary: 'Agregar una imagen al producto',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          ...jsonBody({
            type: 'object',
            required: ['url'],
            properties: {
              url: { type: 'string', maxLength: 500, example: 'https://picsum.photos/seed/nueva/600/600' },
              orden: { type: 'integer', default: 0 },
              esPrincipal: { type: 'boolean', default: false },
            },
          }),
        },
        responses: {
          '201': { description: 'Imagen agregada', ...jsonBody({ type: 'object' }) },
          '400': errRef,
          '401': errRef,
          '403': errRef,
          '404': errRef,
        },
      },
    },

    '/api/v1/productos/{id}/imagenes/{idImagen}': {
      delete: {
        tags: ['Imagenes'],
        summary: 'Eliminar (borrado fisico) una imagen del producto',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'idImagen', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          '200': { description: 'Imagen eliminada', ...jsonBody({ type: 'object', properties: { ok: { type: 'boolean', example: true } } }) },
          '401': errRef,
          '403': errRef,
          '404': errRef,
        },
      },
    },

    '/api/v1/productos/{id}/imagenes/{idImagen}/principal': {
      patch: {
        tags: ['Imagenes'],
        summary: 'Marcar una imagen como principal',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'idImagen', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          '200': { description: 'Imagen marcada como principal', ...jsonBody({ type: 'object' }) },
          '401': errRef,
          '403': errRef,
          '404': errRef,
        },
      },
    },

    '/api/v1/inventario/entradas': {
      post: {
        tags: ['Inventario'],
        summary: 'Registrar entrada de existencia (ENTRADA_COMPRA)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          ...jsonBody({
            type: 'object',
            required: ['idVariante', 'cantidad', 'motivo'],
            properties: {
              idVariante: { type: 'integer', example: 1 },
              cantidad: { type: 'integer', minimum: 1, maximum: 100000, example: 10 },
              motivo: { type: 'string', minLength: 3, maxLength: 300, example: 'Reposicion de stock' },
            },
          }),
        },
        responses: {
          '201': { description: 'Movimiento registrado', ...jsonBody(movimientoKardexSchema) },
          '400': errRef,
          '401': errRef,
          '403': errRef,
          '404': errRef,
          '422': errRef,
        },
      },
    },

    '/api/v1/inventario/ajustes': {
      post: {
        tags: ['Inventario'],
        summary: 'Registrar ajuste de existencia (AJUSTE_POSITIVO / AJUSTE_NEGATIVO)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          ...jsonBody({
            type: 'object',
            required: ['idVariante', 'tipo', 'cantidad', 'motivo'],
            properties: {
              idVariante: { type: 'integer', example: 1 },
              tipo: { type: 'string', enum: ['AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO'], example: 'AJUSTE_NEGATIVO' },
              cantidad: { type: 'integer', minimum: 1, maximum: 100000, example: 3 },
              motivo: { type: 'string', minLength: 3, maxLength: 300, example: 'Merma por inventario fisico' },
            },
          }),
        },
        responses: {
          '201': { description: 'Movimiento registrado', ...jsonBody(movimientoKardexSchema) },
          '400': errRef,
          '401': errRef,
          '403': errRef,
          '404': errRef,
          '422': errRef,
        },
      },
    },

    '/api/v1/inventario/existencias': {
      get: {
        tags: ['Inventario'],
        summary: 'Listar existencias por variante',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'texto', in: 'query', schema: { type: 'string', maxLength: 100 } },
          { name: 'idCategoria', in: 'query', schema: { type: 'integer' } },
          { name: 'soloBajoStock', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
          { name: 'incluirInactivas', in: 'query', schema: { type: 'string', enum: ['true', 'false'] } },
          { name: 'orden', in: 'query', schema: { type: 'string', enum: ['SKU', 'Producto', 'Existencia', 'Disponible', 'UltimoMovimiento'] } },
          { name: 'direccion', in: 'query', schema: { type: 'string', enum: ['ASC', 'DESC'] } },
          { name: 'pagina', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'tamanoPagina', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
        ],
        responses: {
          '200': {
            description: 'Pagina de existencias',
            ...jsonBody({
              type: 'object',
              properties: {
                filas: { type: 'array', items: existenciaSchema },
                total: { type: 'integer', example: 22 },
                pagina: { type: 'integer', example: 1 },
                tamanoPagina: { type: 'integer', example: 20 },
              },
            }),
          },
          '400': errRef,
          '401': errRef,
          '403': errRef,
        },
      },
    },

    '/api/v1/inventario/variantes/{id}/kardex': {
      get: {
        tags: ['Inventario'],
        summary: 'Listar el kardex de una variante',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'desde', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'hasta', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'pagina', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'tamanoPagina', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
        ],
        responses: {
          '200': {
            description: 'Movimientos de la variante con resumen',
            ...jsonBody({
              type: 'object',
              properties: {
                resumen: {
                  type: 'object',
                  properties: {
                    IDVariante: { type: 'integer' },
                    SKU: { type: 'string' },
                    Producto: { type: 'string' },
                    Existencia: { type: 'integer' },
                    Reservado: { type: 'integer' },
                    Disponible: { type: 'integer' },
                  },
                },
                filas: { type: 'array', items: movimientoKardexSchema },
                total: { type: 'integer', example: 2 },
                pagina: { type: 'integer', example: 1 },
                tamanoPagina: { type: 'integer', example: 20 },
              },
            }),
          },
          '400': errRef,
          '401': errRef,
          '403': errRef,
          '404': errRef,
        },
      },
    },

    '/api/v1/inventario/consistencia': {
      get: {
        tags: ['Inventario'],
        summary: 'Auditar el invariante Existencia = SUM(kardex) (Administrador)',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Resultado de la auditoria', ...jsonBody(consistenciaSchema) },
          '401': errRef,
          '403': errRef,
        },
      },
    },

    '/api/v1/carrito': {
      get: {
        tags: ['Carrito'],
        summary: 'Obtener el carrito activo (cliente autenticado o invitado por token)',
        description:
          'Cliente: su carrito activo (Bearer de Cliente). Invitado: carrito del header ' +
          'X-Cart-Token. Sin identidad ni header responde 200 con un carrito vacio sin ' +
          'crear nada. Operador/Administrador reciben 403.',
        security: [{ bearerAuth: [] }, { cartToken: [] }, {}],
        responses: {
          '200': { description: 'Carrito con lineas y totales', ...jsonBody(carritoSchema) },
          '400': errRef,
          '401': errRef,
          '403': errRef,
        },
      },
      delete: {
        tags: ['Carrito'],
        summary: 'Vaciar el carrito (elimina todas las lineas; sigue activo)',
        security: [{ bearerAuth: [] }, { cartToken: [] }, {}],
        responses: {
          '200': { description: 'Carrito vaciado', ...jsonBody(carritoSchema) },
          '400': errRef,
          '401': errRef,
          '403': errRef,
          '409': errRef,
        },
      },
    },

    '/api/v1/carrito/items': {
      post: {
        tags: ['Carrito'],
        summary: 'Agregar un item al carrito (suma a la cantidad existente)',
        description:
          'Invitado sin token: crea el carrito y devuelve el token en el header ' +
          'X-Cart-Token y en el cuerpo (cartToken). Responde 201.',
        security: [{ bearerAuth: [] }, { cartToken: [] }, {}],
        requestBody: {
          required: true,
          ...jsonBody({
            type: 'object',
            required: ['idVariante', 'cantidad'],
            properties: {
              idVariante: { type: 'integer', example: 2 },
              cantidad: { type: 'integer', minimum: 1, maximum: 1000, example: 2 },
            },
          }),
        },
        responses: {
          '201': {
            description: 'Item agregado',
            headers: {
              'X-Cart-Token': {
                description: 'Token del carrito de invitado (solo al crearlo)',
                schema: { type: 'string', format: 'uuid' },
              },
            },
            ...jsonBody(carritoSchema),
          },
          '400': errRef,
          '401': errRef,
          '403': errRef,
          '404': errRef,
          '409': errRef,
          '422': errRef,
        },
      },
    },

    '/api/v1/carrito/items/{idVariante}': {
      put: {
        tags: ['Carrito'],
        summary: 'Fijar la cantidad de una linea (no suma)',
        security: [{ bearerAuth: [] }, { cartToken: [] }, {}],
        parameters: [{ name: 'idVariante', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          ...jsonBody({
            type: 'object',
            required: ['cantidad'],
            properties: { cantidad: { type: 'integer', minimum: 1, maximum: 1000, example: 2 } },
          }),
        },
        responses: {
          '200': { description: 'Cantidad actualizada', ...jsonBody(carritoSchema) },
          '400': errRef,
          '401': errRef,
          '403': errRef,
          '404': errRef,
          '409': errRef,
          '422': errRef,
        },
      },
      delete: {
        tags: ['Carrito'],
        summary: 'Eliminar una linea del carrito',
        security: [{ bearerAuth: [] }, { cartToken: [] }, {}],
        parameters: [{ name: 'idVariante', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          '200': { description: 'Linea eliminada', ...jsonBody(carritoSchema) },
          '400': errRef,
          '401': errRef,
          '403': errRef,
          '404': errRef,
          '409': errRef,
        },
      },
    },

    '/api/v1/carrito/cupon': {
      post: {
        tags: ['Cupones'],
        summary: 'Aplicar un cupon al carrito (solo Cliente autenticado)',
        description:
          'Valida el codigo contra el carrito activo del cliente y lo guarda (un solo ' +
          'cupon por carrito: reemplaza el anterior). Invitado -> 401. Carrito vacio, ' +
          'cupon vencido/agotado/sin monto minimo/no aplica -> 422. Cupon inexistente -> 404.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          ...jsonBody({
            type: 'object',
            required: ['codigo'],
            properties: { codigo: { type: 'string', example: 'PROMO10' } },
          }),
        },
        responses: {
          '200': { description: 'Carrito con el cupon aplicado', ...jsonBody(carritoSchema) },
          '400': errRef,
          '401': errRef,
          '403': errRef,
          '404': errRef,
          '422': errRef,
        },
      },
      delete: {
        tags: ['Cupones'],
        summary: 'Quitar el cupon del carrito (solo Cliente autenticado)',
        description: 'Sin error si el carrito no tenia cupon. Invitado -> 401.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Carrito sin cupon (descuento 0)', ...jsonBody(carritoSchema) },
          '401': errRef,
          '403': errRef,
        },
      },
    },

    '/api/v1/cupones': {
      get: {
        tags: ['Cupones'],
        summary: 'Listar cupones (Administrador)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'texto', in: 'query', schema: { type: 'string' }, description: 'LIKE sobre el codigo' },
          { name: 'activo', in: 'query', schema: { type: 'boolean' } },
          { name: 'soloVigentes', in: 'query', schema: { type: 'boolean', default: false } },
          { name: 'pagina', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'tamanoPagina', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
        ],
        responses: {
          '200': {
            description: 'Pagina de cupones',
            ...jsonBody({
              type: 'object',
              properties: {
                filas: { type: 'array', items: cuponSchema },
                total: { type: 'integer', example: 6 },
                pagina: { type: 'integer', example: 1 },
                tamanoPagina: { type: 'integer', example: 20 },
              },
            }),
          },
          '400': errRef,
          '401': errRef,
          '403': errRef,
        },
      },
      post: {
        tags: ['Cupones'],
        summary: 'Crear un cupon (Administrador)',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, ...jsonBody(cuponBody) },
        responses: {
          '201': { description: 'Cupon creado', ...jsonBody(cuponSchema) },
          '400': errRef,
          '401': errRef,
          '403': errRef,
          '409': errRef,
        },
      },
    },

    '/api/v1/cupones/{id}': {
      get: {
        tags: ['Cupones'],
        summary: 'Obtener un cupon (Administrador)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          '200': { description: 'Cupon', ...jsonBody(cuponSchema) },
          '401': errRef,
          '403': errRef,
          '404': errRef,
        },
      },
      put: {
        tags: ['Cupones'],
        summary: 'Actualizar un cupon (Administrador)',
        description:
          'Un cupon con usos (CuponUso o UsosActuales > 0) no puede cambiar codigo, tipo, ' +
          'valor ni categoria -> 409. Nunca modifica UsosActuales.',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: { required: true, ...jsonBody(cuponBody) },
        responses: {
          '200': { description: 'Cupon actualizado', ...jsonBody(cuponSchema) },
          '400': errRef,
          '401': errRef,
          '403': errRef,
          '404': errRef,
          '409': errRef,
        },
      },
    },

    '/api/v1/cupones/{id}/estado': {
      patch: {
        tags: ['Cupones'],
        summary: 'Activar o desactivar un cupon (Administrador)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          ...jsonBody({
            type: 'object',
            required: ['activo'],
            properties: { activo: { type: 'boolean', example: false } },
          }),
        },
        responses: {
          '200': { description: 'Cupon actualizado', ...jsonBody(cuponSchema) },
          '400': errRef,
          '401': errRef,
          '403': errRef,
          '404': errRef,
        },
      },
    },

    '/api/v1/checkout/iniciar': {
      post: {
        tags: ['Checkout'],
        summary: 'Iniciar checkout: reservar existencia (solo Cliente)',
        description:
          'Valida carrito, direccion y cupon, reserva existencia por RESERVA_MINUTOS y ' +
          'devuelve el resumen. Reiniciable: vuelve a reservar. Carrito vacio o cupon no ' +
          'valido -> 422; direccion inexistente/inactiva -> 404; direccion de otro usuario ' +
          '-> 403; existencia insuficiente -> 409.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          ...jsonBody({
            type: 'object',
            required: ['idDireccion'],
            properties: { idDireccion: { type: 'integer', example: 3 } },
          }),
        },
        responses: {
          '201': { description: 'Existencia reservada', ...jsonBody(checkoutResumenSchema) },
          '400': errRef,
          '401': errRef,
          '403': errRef,
          '404': errRef,
          '409': errRef,
          '422': errRef,
        },
      },
    },

    '/api/v1/checkout/resumen': {
      get: {
        tags: ['Checkout'],
        summary: 'Resumen de checkout sin escribir (solo Cliente)',
        description: 'Mismo formato que iniciar, mas ReservaActiva. Carrito vacio -> resumen null.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Resumen de checkout', ...jsonBody(checkoutResumenSchema) },
          '401': errRef,
          '403': errRef,
        },
      },
    },

    '/api/v1/checkout/pagar': {
      post: {
        tags: ['Checkout'],
        summary: 'Pagar (simulado) y crear el pedido (solo Cliente)',
        description:
          'Idempotente por el header Idempotency-Key (UNIQUE en el pago). Primera vez y ' +
          'replay devuelven el MISMO cuerpo y el MISMO codigo: 201 si aprobado, 402 si ' +
          'rechazado. Exige reserva vigente (si vencio -> 409). Clave en uso por otro ' +
          'usuario -> 409. Carrito vacio -> 422.',
        security: [{ bearerAuth: [] }],
        parameters: [
          {
            name: 'Idempotency-Key',
            in: 'header',
            required: true,
            schema: { type: 'string', minLength: 16, maxLength: 100, pattern: '^[A-Za-z0-9_-]+$' },
            description: 'Clave de idempotencia del intento de pago (16-100, [A-Za-z0-9_-]).',
          },
        ],
        requestBody: {
          required: true,
          ...jsonBody({
            type: 'object',
            required: ['idDireccion', 'metodoPago'],
            properties: {
              idDireccion: { type: 'integer', example: 3 },
              metodoPago: { type: 'string', enum: ['TARJETA', 'TRANSFERENCIA', 'EFECTIVO'], example: 'TARJETA' },
              simularResultado: { type: 'string', enum: ['APROBADO', 'RECHAZADO'], default: 'APROBADO' },
            },
          }),
        },
        responses: {
          '201': { description: 'Pago aprobado y pedido creado', ...jsonBody(pagoResultadoSchema) },
          '402': { description: 'Pago rechazado (simulado); no se creo pedido', ...jsonBody(pagoResultadoSchema) },
          '400': errRef,
          '401': errRef,
          '403': errRef,
          '404': errRef,
          '409': errRef,
          '422': errRef,
        },
      },
    },

    '/api/v1/checkout/reservas/liberar': {
      post: {
        tags: ['Checkout'],
        summary: 'Liberar reservas vencidas (Administrador)',
        description: 'Ejecuta manualmente lo mismo que el job periodico.',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'Reservas liberadas',
            ...jsonBody({
              type: 'object',
              properties: { liberadas: { type: 'integer', example: 0 } },
            }),
          },
          '401': errRef,
          '403': errRef,
        },
      },
    },
  },
};
