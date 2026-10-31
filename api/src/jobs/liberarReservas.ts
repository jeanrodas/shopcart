import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { liberarVencidas } from '../services/checkout.service.js';

let timer: NodeJS.Timeout | null = null;
let enEjecucion = false;

async function ejecutar(): Promise<void> {
  // Si la corrida anterior sigue viva (p. ej. base lenta), esta se salta para no
  // solaparse.
  if (enEjecucion) {
    logger.debug('[job:reservas] corrida anterior en curso; se omite este ciclo');
    return;
  }
  enEjecucion = true;
  try {
    const { liberadas } = await liberarVencidas();
    if (liberadas > 0) {
      logger.info(`[job:reservas] ${liberadas} reserva(s) vencida(s) liberada(s)`);
    }
  } catch (err) {
    // El job nunca tumba el proceso: solo registra el error.
    logger.error({ err }, '[job:reservas] error al liberar reservas vencidas');
  } finally {
    enEjecucion = false;
  }
}

/** Arranca el job periodico de liberacion de reservas vencidas. */
export function iniciarJobReservas(): void {
  if (timer) {
    return;
  }
  timer = setInterval(() => void ejecutar(), env.RESERVA_JOB_SEGUNDOS * 1000);
  // No mantiene vivo el event loop por si solo (apagado limpio).
  timer.unref?.();
  logger.info(`[job:reservas] activo cada ${env.RESERVA_JOB_SEGUNDOS}s`);
}

/** Detiene el job (apagado). */
export function detenerJobReservas(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
