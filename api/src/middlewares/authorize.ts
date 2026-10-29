import type { RequestHandler } from 'express';
import { ForbiddenError, UnauthorizedError } from '../errors/index.js';

/**
 * Restringe el acceso a los roles indicados. Debe ir despues de authenticate.
 * Sin usuario -> 401; rol fuera de la lista -> 403.
 */
export const authorize =
  (...roles: string[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.usuario) {
      next(new UnauthorizedError());
      return;
    }
    if (!roles.includes(req.usuario.rol)) {
      next(new ForbiddenError());
      return;
    }
    next();
  };
