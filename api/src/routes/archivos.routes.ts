import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { ROLES } from '../config/roles.js';
import { rateLimitUpload } from '../middlewares/rateLimitUpload.js';
import { postImagen } from '../controllers/archivos.controller.js';
import { AppError } from '../errors/AppError.js';

// En memoria: 1 solo archivo de hasta 2 MB. El tipo NO se valida aqui (se hace por
// firma de bytes en el controlador); multer solo acota tamano y numero.
// Limites endurecidos: 1 archivo <= 2 MB, SIN campos de texto (fields:0) y a lo sumo 2 partes
// (el archivo + su encabezado), para acotar la superficie del multipart.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0, parts: 2 },
});

// Traduce los errores de multer (p. ej. archivo demasiado grande) al formato de la API.
const subirUno: RequestHandler = (req, res, next) => {
  upload.single('archivo')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new AppError(413, 'PAYLOAD_TOO_LARGE', 'La imagen supera el limite de 2 MB'));
      }
      return next(new AppError(400, 'BAD_REQUEST', 'Archivo invalido'));
    }
    if (err) return next(err as Error);
    next();
  });
};

const router = Router();

// Subida de imagenes: solo Administrador, con rate limit por usuario.
router.post(
  '/imagenes',
  authenticate,
  authorize(ROLES.Administrador),
  rateLimitUpload,
  subirUno,
  postImagen,
);

export default router;
