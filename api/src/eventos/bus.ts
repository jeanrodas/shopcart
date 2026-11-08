import { EventEmitter } from 'node:events';
import { invalidarTodo } from '../utils/reportesCache.js';

/**
 * Bus de eventos de proceso (una sola instancia de API). Lo usan:
 *   1. El flujo SSE (/eventos) para empujar eventos "en vivo" al area interna.
 *   2. La invalidacion del cache de reportes de M9: antes cada servicio llamaba
 *      invalidarTodo() directo; ahora las mutaciones que cambian cifras de reportes
 *      emiten uno de estos eventos y aqui se invalida de forma centralizada (mismo
 *      efecto neto: se invalida exactamente en las mismas mutaciones).
 *
 * Los servicios emiten DESPUES de que el SP confirme (commit): nunca se anuncia un
 * cambio que no ocurrio. El emit es sincrono; los listeners atrapan sus propios
 * errores para no afectar el flujo que emite.
 */

export interface EventosMap {
  'pedido.creado': { idPedido: number; numero: string; total: number; cliente: string; fecha: string };
  'pedido.estado': { idPedido: number; numero: string; de: string | null; a: string; usuario: string };
  'inventario.movimiento': { sku: string; tipo: string; cantidad: number; disponible: number };
  'inventario.bajoStock': { sku: string; disponible: number; umbral: number };
  'cupon.usado': { codigo: string; numeroPedido: string };
}

export type TipoEvento = keyof EventosMap;

export interface EventoSSE<T extends TipoEvento = TipoEvento> {
  tipo: T;
  datos: EventosMap[T];
}

const CANAL = 'evento';
const emitter = new EventEmitter();
// Hasta 5 conexiones SSE por usuario (y varios usuarios) escuchan a la vez; sin tope
// para no disparar la advertencia de "possible memory leak" (las conexiones se limitan
// aparte en sse.ts y se limpian al cerrar).
emitter.setMaxListeners(0);

export function emitir<T extends TipoEvento>(tipo: T, datos: EventosMap[T]): void {
  emitter.emit(CANAL, { tipo, datos } as EventoSSE);
}

/** Suscribe un listener al bus; devuelve la funcion para desuscribirlo. */
export function suscribir(fn: (evento: EventoSSE) => void): () => void {
  emitter.on(CANAL, fn);
  return () => emitter.off(CANAL, fn);
}

/** Numero de suscriptores del bus (listeners del canal). Para pruebas/diagnostico. */
export function numSuscriptores(): number {
  return emitter.listenerCount(CANAL);
}

/**
 * Eventos que cambian cifras de reportes/dashboard y por tanto invalidan su cache.
 * (inventario.bajoStock se deriva de un movimiento que ya emitio inventario.movimiento,
 * por eso no necesita invalidar otra vez.)
 */
const INVALIDAN_REPORTES = new Set<TipoEvento>([
  'pedido.creado',
  'pedido.estado',
  'inventario.movimiento',
  'cupon.usado',
]);

suscribir((e) => {
  if (INVALIDAN_REPORTES.has(e.tipo)) invalidarTodo();
});
