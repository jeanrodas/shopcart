import {
  peticion,
  fijarAccessToken,
  fijarRefreshToken,
  fijarCartToken,
  obtenerRefreshToken,
  cerrarSesionLocal,
} from './clienteHttp';
import type { RespuestaSesion } from './tipos';

/** Inicia sesion. Envia el X-Cart-Token para fusionar el carrito de invitado. */
export async function iniciarSesion(correo: string, contrasena: string): Promise<RespuestaSesion> {
  const data = await peticion<RespuestaSesion>('/api/v1/auth/login', {
    method: 'POST',
    body: { correo, contrasena },
    sinRefresh: true,
  });
  fijarAccessToken(data.accessToken);
  fijarRefreshToken(data.refreshToken);
  // El carrito de invitado ya quedo fusionado en la cuenta: el token deja de servir.
  fijarCartToken(null);
  return data;
}

/** Cierra la sesion (revoca el refresh en el servidor y limpia el estado local). */
export async function cerrarSesion(): Promise<void> {
  const rt = obtenerRefreshToken();
  try {
    if (rt) {
      await peticion('/api/v1/auth/logout', {
        method: 'POST',
        body: { refreshToken: rt },
        sinRefresh: true,
      });
    }
  } finally {
    cerrarSesionLocal();
  }
}
