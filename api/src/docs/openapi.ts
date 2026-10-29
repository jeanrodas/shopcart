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
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
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
          '201': { description: 'Cliente registrado', ...jsonBody(sesionResponse) },
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
          '200': { description: 'Sesion iniciada', ...jsonBody(sesionResponse) },
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
  },
};
