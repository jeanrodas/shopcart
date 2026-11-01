import { env } from '../config/env.js';

/**
 * Cache en memoria para los reportes de Administrador (RF-08).
 *
 * - TTL por entrada (env.REPORTES_CACHE_TTL_SEGUNDOS; 0 desactiva el cache).
 * - Clave estable: nombre de reporte + sus parametros ordenados por nombre. Las
 *   fechas se truncan a minuto (el SP recibe DATETIME2(0), precision de segundo),
 *   de modo que llamadas casi simultaneas comparten entrada.
 * - Limite de entradas (LRU simple) para evitar crecimiento ilimitado.
 * - Versionado + single-flight para una invalidacion correcta ante concurrencia:
 *     * invalidarTodo() limpia el mapa e incrementa `version`.
 *     * conCache() captura la version antes de calcular y SOLO guarda el resultado
 *       si la version no cambio mientras tanto (si hubo una mutacion durante el
 *       calculo, no se cachea un dato ya obsoleto).
 *     * Un mapa de promesas en vuelo evita recomputar la misma clave en paralelo.
 *
 * Con varias instancias de API este cache seria por-proceso; el equivalente
 * compartido es Redis con la misma clave y el mismo evento de invalidacion.
 *
 * No guarda nada por usuario (todas las rutas son de Administrador) y nunca cachea
 * respuestas de error (el SP lanza antes de que se guarde la entrada).
 */

const MAX_ENTRADAS = 200;

interface Entrada {
  valor: unknown;
  expira: number;
}

const cache = new Map<string, Entrada>();
const enCurso = new Map<string, Promise<unknown>>();
let version = 0;

function ttlSegundos(): number {
  return env.REPORTES_CACHE_TTL_SEGUNDOS;
}

export function cacheHabilitado(): boolean {
  return ttlSegundos() > 0;
}

function normalizar(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  // Fechas truncadas a minuto (YYYY-MM-DDTHH:MM).
  if (valor instanceof Date) return valor.toISOString().slice(0, 16);
  return String(valor);
}

/** Clave estable: ordena las claves de params para que el orden no afecte. */
export function claveReporte(nombre: string, params: Record<string, unknown>): string {
  const partes = Object.keys(params)
    .sort()
    .map((k) => `${k}=${normalizar(params[k])}`);
  return `${nombre}?${partes.join('&')}`;
}

export function obtener<T>(clave: string): T | undefined {
  if (!cacheHabilitado()) return undefined;
  const entrada = cache.get(clave);
  if (!entrada) return undefined;
  if (Date.now() > entrada.expira) {
    cache.delete(clave);
    return undefined;
  }
  // LRU: reinsertar para marcarla como la mas reciente.
  cache.delete(clave);
  cache.set(clave, entrada);
  return entrada.valor as T;
}

export function guardar(clave: string, valor: unknown): void {
  const ttl = ttlSegundos();
  if (ttl <= 0) return;
  cache.delete(clave);
  cache.set(clave, { valor, expira: Date.now() + ttl * 1000 });
  while (cache.size > MAX_ENTRADAS) {
    const masAntigua = cache.keys().next().value;
    if (masAntigua === undefined) break;
    cache.delete(masAntigua);
  }
}

/** Invalida todo el cache de reportes (lo llaman los servicios que mutan datos). */
export function invalidarTodo(): void {
  cache.clear();
  version += 1;
}

/**
 * Ejecuta `calcular` solo si no hay entrada vigente ni computo en vuelo. Guarda el
 * resultado unicamente si no hubo invalidacion durante el calculo; nunca cachea
 * errores. Devuelve si la respuesta salio del cache / de un computo compartido.
 */
export async function conCache<T>(
  nombre: string,
  params: Record<string, unknown>,
  calcular: () => Promise<T>,
): Promise<{ data: T; cacheHit: boolean }> {
  const habilitado = cacheHabilitado();
  const clave = claveReporte(nombre, params);

  if (habilitado) {
    const cacheado = obtener<T>(clave);
    if (cacheado !== undefined) return { data: cacheado, cacheHit: true };
    const enVuelo = enCurso.get(clave) as Promise<T> | undefined;
    if (enVuelo) return { data: await enVuelo, cacheHit: true };
  }

  const versionAlInicio = version;
  const promesa = calcular();
  if (habilitado) enCurso.set(clave, promesa as Promise<unknown>);
  try {
    const data = await promesa;
    // Solo se cachea si nadie invalido mientras se calculaba (evita datos obsoletos).
    if (habilitado && version === versionAlInicio) guardar(clave, data);
    return { data, cacheHit: false };
  } finally {
    if (habilitado) enCurso.delete(clave);
  }
}
