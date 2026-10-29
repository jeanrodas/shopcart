import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError, UnauthorizedError } from '../errors/index.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: { id: number; rol: string; nombre: string };
    }
  }
}

interface AccessPayload {
  sub: number;
  rol: string;
  nombre: string;
}

/**
 * Verifica el access token (Authorization: Bearer) con JWT_ACCESS_SECRET y
 * adjunta req.usuario. Token ausente/invalido -> 401 UNAUTHORIZED;
 * token expirado -> 401 TOKEN_EXPIRED (para que el frontend sepa refrescar).
 */
export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    next(new UnauthorizedError('Token de acceso ausente o invalido'));
    return;
  }

  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as unknown as AccessPayload;
    req.usuario = { id: Number(payload.sub), rol: payload.rol, nombre: payload.nombre };
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      next(new AppError(401, 'TOKEN_EXPIRED', 'El token de acceso expiro'));
      return;
    }
    next(new UnauthorizedError('Token de acceso invalido'));
  }
};
