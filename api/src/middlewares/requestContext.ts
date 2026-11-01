import type { RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

// Se acepta un X-Request-Id entrante solo si es seguro para loguear y propagar;
// cualquier otra cosa se reemplaza por un UUID generado.
const REQUEST_ID_VALIDO = /^[A-Za-z0-9._-]{1,100}$/;

export const requestContext: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');
  req.requestId = incoming && REQUEST_ID_VALIDO.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.requestId);
  next();
};
