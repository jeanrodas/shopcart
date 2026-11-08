import { peticion } from './clienteHttp';
import type { ImagenSubida } from './tipos';

/**
 * Sube una imagen al admin (POST /archivos/imagenes, multipart). Pasa el FormData por el
 * cliente HTTP (que NO fija Content-Type para que el navegador ponga el boundary) y asi
 * hereda la renovacion transparente del access token tras un TOKEN_EXPIRED.
 */
export async function subirImagen(archivo: File): Promise<ImagenSubida> {
  const fd = new FormData();
  fd.append('archivo', archivo);
  return peticion<ImagenSubida>('/api/v1/archivos/imagenes', { method: 'POST', body: fd });
}
