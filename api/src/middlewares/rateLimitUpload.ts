import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

/**
 * Rate limiting de la subida de imagenes del admin: por usuario autenticado (no por IP,
 * ya que un admin puede subir varias imagenes seguidas desde el panel). Mismo formato de
 * error 429 que el resto de la API.
 */
export const rateLimitUpload = rateLimit({
  windowMs: env.RATE_LIMIT_UPLOAD_VENTANA_MIN * 60 * 1000,
  limit: env.RATE_LIMIT_UPLOAD_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.usuario?.id ?? req.ip ?? 'desconocido'),
  handler: (req, res) => {
    res.status(429).json({
      code: 'RATE_LIMITED',
      message: 'Demasiadas subidas; intente mas tarde',
      requestId: req.requestId ?? 'desconocido',
    });
  },
});
