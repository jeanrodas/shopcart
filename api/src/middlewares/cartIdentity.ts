import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { AppError, ForbiddenError, UnauthorizedError } from '../errors/index.js';
import { ROLES } from '../config/roles.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      carrito?: { idUsuario?: number; tokenInvitado?: string };
    }
  }
}

interface AccessPayload {
  sub: number;
  rol: string;
  nombre: string;
}

const uuidSchema = z.string().uuid();

/**
 * Resuelve la identidad del carrito para /carrito/*. La identidad manda sobre el
 * header: si hay Authorization Bearer se usa el usuario y se ignora X-Cart-Token.
 *   - Bearer valido de rol Cliente -> req.carrito = { idUsuario } (y req.usuario).
 *   - Bearer de otro rol (Operador/Administrador) -> 403.
 *   - Bearer invalido/expirado -> 401 (nunca se degrada a invitado).
 *   - Sin Bearer -> invitado: X-Cart-Token opcional y, si viene, debe ser UUID.
 */
export const cartIdentity: RequestHandler = (req, _res, next) => {
  const header = req.header('authorization') ?? '';
  const [scheme, token] = header.split(' ');

  if (scheme === 'Bearer' && token) {
    try {
      const payload = jwt.verify(token, env.JWT_ACCESS_SECRET) as unknown as AccessPayload;
      if (payload.rol !== ROLES.Cliente) {
        next(new ForbiddenError('El carrito es exclusivo de clientes'));
        return;
      }
      req.usuario = { id: Number(payload.sub), rol: payload.rol, nombre: payload.nombre };
      req.carrito = { idUsuario: Number(payload.sub) };
      next();
      return;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        next(new AppError(401, 'TOKEN_EXPIRED', 'El token de acceso expiro'));
        return;
      }
      next(new UnauthorizedError('Token de acceso invalido'));
      return;
    }
  }

  // Invitado: el header X-Cart-Token es opcional, pero si viene debe ser un UUID.
  const raw = req.header('x-cart-token');
  if (raw === undefined || raw === '') {
    req.carrito = {};
    next();
    return;
  }

  const parsed = uuidSchema.safeParse(raw);
  if (!parsed.success) {
    next(new AppError(400, 'VALIDATION_ERROR', 'X-Cart-Token invalido: debe ser un UUID'));
    return;
  }

  req.carrito = { tokenInvitado: parsed.data };
  next();
};
