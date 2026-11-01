import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { env } from '../config/env.js';

/**
 * Rate limiting de la aplicacion de cupones al carrito (POST /carrito/cupon y
 * /carrito/cupon/validar), para frenar el sondeo de codigos. Se aplica DESPUES de
 * cartIdentity, por lo que la clave es la identidad del carrito: id del usuario
 * autenticado, o el token de invitado, o -como ultimo recurso- la IP normalizada
 * (ipKeyGenerator evita el aviso ERR_ERL_KEY_GEN_IPV6). Ventana de 1 minuto,
 * maximo RATE_LIMIT_CUPON_MAX. La respuesta 429 usa el formato de error estandar.
 */
export const rateLimitCupon = rateLimit({
  windowMs: 60 * 1000,
  limit: env.RATE_LIMIT_CUPON_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const c = req.carrito;
    if (c?.idUsuario) return `u:${c.idUsuario}`;
    if (c?.tokenInvitado) return `t:${c.tokenInvitado}`;
    return ipKeyGenerator(req.ip ?? '');
  },
  handler: (req, res) => {
    res.status(429).json({
      code: 'RATE_LIMITED',
      message: 'Demasiados intentos con cupones; intente mas tarde',
      requestId: req.requestId ?? 'desconocido',
    });
  },
});
