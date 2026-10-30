import { env } from '../config/env.js';
import { liberarVencidas } from '../services/checkout.service.js';

let timer: NodeJS.Timeout | null = null;

async function ejecutar(): Promise<void> {
  try {
    const { liberadas } = await liberarVencidas();
    if (liberadas > 0) {
      console.log(`[job:reservas] ${liberadas} reserva(s) vencida(s) liberada(s)`);
    }
  } catch (err) {
    // El job nunca tumba el proceso: solo registra el error.
    console.error('[job:reservas] error al liberar reservas vencidas:', err);
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
  console.log(`[job:reservas] activo cada ${env.RESERVA_JOB_SEGUNDOS}s`);
}

/** Detiene el job (apagado). */
export function detenerJobReservas(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
