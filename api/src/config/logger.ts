// Carga .env antes de leer LOG_LEVEL / NODE_ENV: este modulo puede evaluarse
// antes del cuerpo de env.ts (los imports se evaluan primero), y no importa env.js
// para no crear un ciclo (env.ts si usa este logger).
import 'dotenv/config';
import { pino } from 'pino';
import { pinoHttp } from 'pino-http';
import type { IncomingMessage, ServerResponse } from 'node:http';

const level = process.env.LOG_LEVEL ?? 'info';
const isDevelopment = process.env.NODE_ENV === 'development';

/** Logger de aplicacion. Salida JSON en todos los entornos; legible solo en dev. */
export const logger = pino({
  level,
  ...(isDevelopment
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:standard', ignore: 'pid,hostname' },
        },
      }
    : {}),
});

/**
 * Middleware HTTP: una linea por request con metodo, url (sin query), status,
 * duracion y requestId (el mismo de requestContext). Nunca registra headers,
 * cuerpos ni la query. /health se omite.
 */
export const httpLogger = pinoHttp({
  logger,
  // Reusa el requestId acunado por requestContext (ya corrio antes de este middleware).
  genReqId: (req: IncomingMessage) => (req as { requestId?: string }).requestId ?? '',
  autoLogging: { ignore: (req: IncomingMessage) => (req.url ?? '').startsWith('/health') },
  customLogLevel: (_req: IncomingMessage, res: ServerResponse, err?: Error) =>
    res.statusCode >= 500 || err ? 'error' : res.statusCode >= 400 ? 'warn' : 'info',
  // Serializadores minimos: solo metodo y ruta (sin query), y status. Sin headers
  // ni cuerpos. El redact es defensa adicional por si se ampliaran los campos.
  serializers: {
    req: (req: IncomingMessage & { id?: string; method?: string; url?: string }) => ({
      id: req.id,
      method: req.method,
      url: (req.url ?? '').split('?')[0],
    }),
    res: (res: ServerResponse) => ({ status: res.statusCode }),
  },
  redact: {
    paths: ['req.headers.authorization', 'req.headers["x-cart-token"]', 'req.headers["idempotency-key"]'],
    remove: true,
  },
});
