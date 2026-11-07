import { ErrorApi, obtenerAccessToken } from './clienteHttp';
import type { ImagenSubida } from './tipos';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/**
 * Sube una imagen al admin (POST /archivos/imagenes, multipart). Usa fetch directo
 * porque el cuerpo es FormData (el navegador fija el boundary; no se envia JSON).
 */
export async function subirImagen(archivo: File): Promise<ImagenSubida> {
  const fd = new FormData();
  fd.append('archivo', archivo);
  const token = obtenerAccessToken();
  const res = await fetch(`${BASE}/api/v1/archivos/imagenes`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  });
  if (!res.ok) {
    let codigo = `HTTP_${res.status}`;
    let mensaje = 'No se pudo subir la imagen';
    try {
      const j = (await res.json()) as { code?: string; message?: string };
      codigo = j.code ?? codigo;
      mensaje = j.message ?? mensaje;
    } catch {
      /* sin cuerpo JSON */
    }
    throw new ErrorApi({ status: res.status, codigo, mensaje });
  }
  return (await res.json()) as ImagenSubida;
}
