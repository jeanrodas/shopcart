import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

/**
 * Rate limiting para los endpoints de autenticacion. La respuesta 429 usa el
 * handler de la libreria para emitir el MISMO formato de error del resto de la
 * API: { code, message, requestId }.
 */
export const rateLimitAuth = rateLimit({
  windowMs: env.RATE_LIMIT_AUTH_VENTANA_MIN * 60 * 1000,
  limit: env.RATE_LIMIT_AUTH_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      code: 'RATE_LIMITED',
      message: 'Demasiados intentos; intente mas tarde',
      requestId: req.requestId ?? 'desconocido',
    });
  },
});
