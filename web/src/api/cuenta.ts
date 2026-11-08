import { peticion } from './clienteHttp';
import type { PerfilInput, PerfilUsuario } from './tipos';

/** Perfil del usuario autenticado (GET /usuarios/me). */
export function obtenerPerfil(): Promise<PerfilUsuario> {
  return peticion<PerfilUsuario>('/api/v1/usuarios/me');
}

/** Actualiza el propio nombre y telefono (PUT /usuarios/me). */
export function actualizarPerfil(datos: PerfilInput): Promise<PerfilUsuario> {
  return peticion<PerfilUsuario>('/api/v1/usuarios/me', { method: 'PUT', body: datos });
}

/** Cambia la contrasena (POST /auth/cambiar-contrasena → 204). */
export async function cambiarContrasena(
  contrasenaActual: string,
  contrasenaNueva: string,
): Promise<void> {
  await peticion('/api/v1/auth/cambiar-contrasena', {
    method: 'POST',
    body: { contrasenaActual, contrasenaNueva },
  });
}
