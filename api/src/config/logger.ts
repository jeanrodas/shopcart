import { createRequire } from 'node:module';
import { pino } from 'pino';
import { pinoHttp } from 'pino-http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { env } from './env.js';

const level = env.LOG_LEVEL;
const isDevelopment = env.NODE_ENV === 'development';

/**
 * pino-pretty es dependencia de desarrollo. La imagen de produccion se construye con
 * `npm ci --omit=dev`, por lo que puede NO estar instalada aun con NODE_ENV=development.
 * Solo se usa el transport si es desarrollo Y el modulo se resuelve; si no, salida JSON.
 * Asi el logger nunca cae por "unable to determine transport target for pino-pretty".
 */
function prettyDisponible(): boolean {
  try {
    createRequire(import.meta.url).resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

const usarPretty = isDevelopment && prettyDisponible();

/** Logger de aplicacion. Salida JSON; legible (pino-pretty) solo en dev y si existe. */
export const logger = pino({
  level,
  ...(usarPretty
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
