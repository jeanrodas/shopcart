import { peticion } from './clienteHttp';
import type { RespuestaCarrito } from './tipos';

/**
 * Carrito de la identidad actual (cliente autenticado o invitado). El clienteHttp
 * ya adjunta el X-Cart-Token guardado y persiste el que devuelva la respuesta.
 */
export function obtenerCarrito(signal?: AbortSignal): Promise<RespuestaCarrito> {
  return peticion<RespuestaCarrito>('/api/v1/carrito', { signal });
}

export function agregarItem(datos: { idVariante: number; cantidad: number }): Promise<RespuestaCarrito> {
  return peticion<RespuestaCarrito>('/api/v1/carrito/items', { method: 'POST', body: datos });
}

/** Fija la cantidad de una linea (no suma): PUT /carrito/items/:idVariante. */
export function actualizarItem(idVariante: number, cantidad: number): Promise<RespuestaCarrito> {
  return peticion<RespuestaCarrito>(`/api/v1/carrito/items/${idVariante}`, {
    method: 'PUT',
    body: { cantidad },
  });
}

export function quitarItem(idVariante: number): Promise<RespuestaCarrito> {
  return peticion<RespuestaCarrito>(`/api/v1/carrito/items/${idVariante}`, { method: 'DELETE' });
}

export function vaciarCarrito(): Promise<RespuestaCarrito> {
  return peticion<RespuestaCarrito>('/api/v1/carrito', { method: 'DELETE' });
}

/** Aplica un cupon al carrito (solo cliente). El campo del cuerpo es `codigo`. */
export function aplicarCupon(codigo: string): Promise<RespuestaCarrito> {
  return peticion<RespuestaCarrito>('/api/v1/carrito/cupon', { method: 'POST', body: { codigo } });
}

export function quitarCupon(): Promise<RespuestaCarrito> {
  return peticion<RespuestaCarrito>('/api/v1/carrito/cupon', { method: 'DELETE' });
}
