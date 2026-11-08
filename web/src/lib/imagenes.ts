const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

/**
 * Resuelve la URL de una imagen para usar en <img src>. Las imagenes subidas por el
 * admin viven en la API ("/uploads/…") y necesitan el origen de la API; las imagenes
 * del sitio ("/img/…") o absolutas (http/https) se devuelven tal cual.
 */
export function resolverImagen(url: string | null | undefined): string {
  if (!url) return '';
  if (url.startsWith('/uploads/')) return `${BASE}${url}`;
  // Lista blanca en el cliente: solo rutas del sitio ("/…") o URLs https://. Cualquier otra
  // cosa (javascript:, data:, http://, texto suelto) se descarta para no inyectarla en <img src>.
  if (url.startsWith('/') || url.startsWith('https://')) return url;
  return '';
}
