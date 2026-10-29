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
  },
};
