import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { env } from './config/env.js';
import { requestContext } from './middlewares/requestContext.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { NotFoundError } from './errors/index.js';
import routes from './routes/index.js';
import { openapiDocument } from './docs/openapi.js';

const app = express();

app.disable('x-powered-by');
app.use(helmet());
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

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiDocument));

app.use('/', routes);

// 404 estandar para cualquier ruta no registrada.
app.use((req, _res, next) => {
  next(new NotFoundError(`Ruta no encontrada: ${req.method} ${req.originalUrl}`));
});

app.use(errorHandler);

export default app;
