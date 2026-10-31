import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { env } from '../config/env.js';

/**
 * Rate limiting del checkout, por usuario autenticado. Protege /checkout/iniciar y
 * /checkout/pagar de un cliente que reintente en bucle (el reinicio de checkout es
 * libre). Se aplica DESPUES de authenticate/authorize, por lo que req.usuario ya
 * esta resuelto; la clave es su id (no la IP, para no castigar a varios clientes
 * detras de un mismo NAT). Como fallback -si por algun motivo no hubiera usuario- se
 * usa el helper ipKeyGenerator, que normaliza IPv6 (req.ip crudo dispararia el aviso
 * ERR_ERL_KEY_GEN_IPV6 de express-rate-limit). La respuesta 429 usa el MISMO formato
 * de error del resto de la API: { code, message, requestId }.
 */
export const rateLimitCheckout = rateLimit({
  windowMs: 60 * 1000,
  limit: env.RATE_LIMIT_CHECKOUT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.usuario ? `u:${req.usuario.id}` : ipKeyGenerator(req.ip ?? '')),
  handler: (req, res) => {
    res.status(429).json({
      code: 'RATE_LIMITED',
      message: 'Demasiadas operaciones de checkout; intente mas tarde',
      requestId: req.requestId ?? 'desconocido',
    });
  },
});
