import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { env } from './env.js';

/**
 * Carpeta raiz de subidas (absoluta). UPLOADS_DIR por defecto 'uploads' relativo al
 * directorio de trabajo de la API (api/). Las imagenes van en <raiz>/img.
 */
export const UPLOADS_ROOT = path.resolve(env.UPLOADS_DIR);
export const UPLOADS_IMG_DIR = path.join(UPLOADS_ROOT, 'img');

/** Crea la carpeta de imagenes si no existe (se llama al arrancar). */
export function asegurarCarpetaUploads(): void {
  mkdirSync(UPLOADS_IMG_DIR, { recursive: true });
}
