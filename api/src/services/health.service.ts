import { executeSp } from '../data/spExecutor.js';

/**
 * Verifica la disponibilidad de la BD ejecutando SP_Sistema_Ping.
 * Nunca lanza: si la BD o el SP fallan, devuelve 'error'.
 */
export async function checkDbHealth(): Promise<'ok' | 'error'> {
  try {
    const result = await executeSp<{ Ok: number }>('SP_Sistema_Ping', []);
    return result.recordset[0]?.Ok === 1 ? 'ok' : 'error';
  } catch {
    return 'error';
  }
}
