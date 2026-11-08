import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

/**
 * Rate limiting para POST /eventos/ticket (10/min por defecto). Mismo formato de error
 * 429 que el resto de la API. El stream GET /eventos no se limita aqui: lo acota el
 * tope de conexiones por usuario y el ticket de un solo uso.
 */
export const rateLimitEventos = rateLimit({
  windowMs: 60 * 1000,
  limit: env.RATE_LIMIT_EVENTOS_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({
      code: 'RATE_LIMITED',
      message: 'Demasiados tickets; intente mas tarde',
      requestId: req.requestId ?? 'desconocido',
    });
  },
});
