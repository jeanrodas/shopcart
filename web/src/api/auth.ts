import { peticion, fijarAccessToken, fijarRefreshToken, fijarCartToken } from './clienteHttp';
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

/** Crea una cuenta. Envia el X-Cart-Token para fusionar el carrito de invitado. */
export async function registrar(datos: {
  nombre: string;
  correo: string;
  contrasena: string;
}): Promise<RespuestaSesion> {
  const data = await peticion<RespuestaSesion>('/api/v1/auth/registro', {
    method: 'POST',
    body: datos,
    sinRefresh: true,
  });
  fijarAccessToken(data.accessToken);
  fijarRefreshToken(data.refreshToken);
  // El carrito de invitado ya quedo fusionado en la cuenta: el token deja de servir.
  fijarCartToken(null);
  return data;
}

/**
 * Revoca el refresh en el servidor. NO toca el estado local (tokens, cache ni sesion):
 * de eso se encarga AuthContext ANTES de llamar aqui, de forma sincrona, para que el
 * cierre no dependa de la respuesta de /auth/logout. Recibe el refresh ya capturado.
 */
export async function cerrarSesionServidor(refreshToken: string | null): Promise<void> {
  if (!refreshToken) return;
  await peticion('/api/v1/auth/logout', {
    method: 'POST',
    body: { refreshToken },
    sinRefresh: true,
  });
}
