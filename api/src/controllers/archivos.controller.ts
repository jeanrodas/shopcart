import type { RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { UPLOADS_IMG_DIR } from '../config/uploads.js';
import { AppError } from '../errors/AppError.js';

interface TipoImagen {
  ext: string;
  mime: string;
}

/**
 * Detecta el tipo por FIRMA DE BYTES (magic numbers), no por extension ni Content-Type.
 * JPEG: FF D8 FF | PNG: 89 50 4E 47 | WebP: "RIFF"...."WEBP". Cualquier otro (incl. SVG) -> null.
 */
function detectarTipo(buf: Buffer): TipoImagen | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return { ext: 'png', mime: 'image/png' };
  }
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return { ext: 'webp', mime: 'image/webp' };
  }
  return null;
}

/**
 * POST /archivos/imagenes (Administrador). Valida la imagen por su firma de bytes,
 * la guarda con un nombre aleatorio (nunca el original) y responde la URL publica.
 */
export const postImagen: RequestHandler = async (req, res) => {
  const file = req.file;
  if (!file) {
    throw new AppError(400, 'BAD_REQUEST', 'Falta el archivo en el campo "archivo"');
  }
  const tipo = detectarTipo(file.buffer);
  if (!tipo) {
    throw new AppError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Solo se permiten imagenes JPG, PNG o WebP');
  }
  const nombre = `${randomUUID()}.${tipo.ext}`;
  await writeFile(path.join(UPLOADS_IMG_DIR, nombre), file.buffer);
  res.status(201).json({ url: `/uploads/img/${nombre}`, bytes: file.size, tipo: tipo.mime });
};
