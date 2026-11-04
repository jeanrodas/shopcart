import { readFileSync } from 'node:fs';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { requestContext } from './middlewares/requestContext.js';
import { httpLogger } from './config/logger.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { NotFoundError } from './errors/index.js';
import routes from './routes/index.js';
import { openapiDocument } from './docs/openapi.js';

// Version desde package.json (resuelto en runtime relativo a este archivo: funciona en
// dev -src- y en la build -dist-, ambos a un nivel de api/package.json).
const pkg = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string };

const app = express();

// Numero de saltos de proxy de confianza para derivar req.ip de X-Forwarded-For.
// 0 (default) = sin proxy: usa la IP del socket. Detras de un proxy/balanceador,
// fijar TRUST_PROXY al numero de proxies propios (ver .env.example).
app.set('trust proxy', env.TRUST_PROXY);

app.disable('x-powered-by');
// Cabeceras de seguridad. crossOriginResourcePolicy same-origin evita que otros
// origenes embeban las respuestas de esta API.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'same-origin' },
  }),
);
// Permissions-Policy: helmet 8 no la incluye, se fija a mano para desactivar APIs
// sensibles del navegador que esta API nunca necesita.
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    // X-Cart-Token viaja en peticiones y respuestas del carrito de invitado.
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Cart-Token', 'X-Request-Id', 'Idempotency-Key'],
    exposedHeaders: ['X-Cart-Token', 'X-Request-Id'],
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(requestContext);
// Log HTTP (una linea por request) antes de las rutas; omite /health.
app.use(httpLogger);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiDocument));

// Raiz: metadatos publicos de la API (sin autenticacion). Se deja logueado (trafico real).
app.get('/', (_req, res) => {
  res.status(200).json({
    nombre: 'ShopCart API',
    version: pkg.version,
    fase: 'Fase 1 - backend',
    modoDemo: env.MODO_DEMO,
    enlaces: { health: '/health', apiDocs: '/api-docs', apiBase: '/api/v1' },
  });
});

app.use('/', routes);

// 404 estandar para cualquier ruta no registrada.
app.use((req, _res, next) => {
  next(new NotFoundError(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
});

app.use(errorHandler);

export default app;
