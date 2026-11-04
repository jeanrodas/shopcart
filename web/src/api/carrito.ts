import { peticion } from './clienteHttp';
import type { RespuestaCarrito } from './tipos';

/**
 * Carrito de la identidad actual (cliente autenticado o invitado). El clienteHttp
 * ya adjunta el X-Cart-Token guardado y persiste el que devuelva la respuesta.
 */
export function obtenerCarrito(): Promise<RespuestaCarrito> {
  return peticion<RespuestaCarrito>('/api/v1/carrito');
}

export function agregarItem(datos: { idVariante: number; cantidad: number }): Promise<RespuestaCarrito> {
  return peticion<RespuestaCarrito>('/api/v1/carrito/items', { method: 'POST', body: datos });
}
