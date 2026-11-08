import { peticion } from './clienteHttp';
import type { PagarBody, ResultadoPago, ResumenCheckout } from './tipos';

/** Paso 1: reserva existencia con la direccion elegida. Responde 201. */
export function iniciar(idDireccion: number): Promise<ResumenCheckout> {
  return peticion<ResumenCheckout>('/api/v1/checkout/iniciar', {
    method: 'POST',
    body: { idDireccion },
  });
}

/** Solo lectura: totales + ReservaActiva del carrito del cliente. */
export function resumen(): Promise<ResumenCheckout> {
  return peticion<ResumenCheckout>('/api/v1/checkout/resumen');
}

/**
 * Paso 2: cobra (simulado) con la clave de idempotencia. El pago rechazado responde
 * 402 con el MISMO cuerpo (ResultadoPago, aprobado=false), por eso se acepta como ok.
 */
export function pagar(datos: PagarBody, claveIdempotencia: string): Promise<ResultadoPago> {
  return peticion<ResultadoPago>('/api/v1/checkout/pagar', {
    method: 'POST',
    body: datos,
    headers: { 'Idempotency-Key': claveIdempotencia },
    estadosOk: [402],
  });
}
