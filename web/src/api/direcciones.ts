import { peticion } from './clienteHttp';
import type { Direccion, DireccionInput } from './tipos';

/** Direcciones del usuario autenticado. */
export function listarDirecciones(): Promise<Direccion[]> {
  return peticion<Direccion[]>('/api/v1/direcciones');
}

export function crearDireccion(datos: DireccionInput): Promise<Direccion> {
  return peticion<Direccion>('/api/v1/direcciones', { method: 'POST', body: datos });
}

export function actualizarDireccion(id: number, datos: DireccionInput): Promise<Direccion> {
  return peticion<Direccion>(`/api/v1/direcciones/${id}`, { method: 'PUT', body: datos });
}

export function eliminarDireccion(id: number): Promise<{ ok: boolean }> {
  return peticion<{ ok: boolean }>(`/api/v1/direcciones/${id}`, { method: 'DELETE' });
}
