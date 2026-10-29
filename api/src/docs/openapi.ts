export const openapiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'ShopCart API',
    version: '1.0.0',
    description: 'API de la plataforma de e-commerce ShopCart.',
  },
  servers: [{ url: '/', description: 'Servidor actual' }],
  tags: [{ name: 'Sistema', description: 'Endpoints de infraestructura y salud' }],
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
  },
} as const;
