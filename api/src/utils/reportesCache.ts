/**
 * Cache en memoria para los reportes de Administrador (RF-08).
 *
 * - TTL por entrada (REPORTES_CACHE_TTL_SEGUNDOS, default 60; 0 desactiva el cache).
 * - Clave estable: nombre de reporte + sus parametros ordenados por nombre, de modo
 *   que el mismo reporte con los mismos filtros reusa la entrada.
 * - Limite de entradas (LRU simple) para evitar crecimiento ilimitado.
 * - invalidarTodo() lo vacian los servicios que cambian ventas o inventario tras un
 *   SP exitoso (crear pedido aprobado, cambiar estado/cancelar/devolucion, movimientos
 *   de inventario), de modo que el proximo reporte recomputa.
 *
 * Con varias instancias de API este cache seria por-proceso; el equivalente
 * compartido es Redis con la misma clave y el mismo evento de invalidacion.
 *
 * No guarda nada por usuario: todas las rutas son de Administrador y los datos no
 * son personales; la clave solo depende del reporte y sus parametros. Nunca se
 * cachean respuestas de error (el SP lanza antes de que se guarde la entrada).
 */

const MAX_ENTRADAS = 200;

interface Entrada {
  valor: unknown;
  expira: number;
}

const cache = new Map<string, Entrada>();

/** TTL en segundos leido del entorno en cada operacion (0 o invalido desactiva). */
function ttlSegundos(): number {
  const raw = Number(process.env.REPORTES_CACHE_TTL_SEGUNDOS ?? '60');
  return Number.isFinite(raw) && raw >= 0 ? raw : 60;
}

export function cacheHabilitado(): boolean {
  return ttlSegundos() > 0;
}

function normalizar(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (valor instanceof Date) return valor.toISOString();
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
  // Desaloja las entradas mas antiguas si se supera el limite.
  while (cache.size > MAX_ENTRADAS) {
    const masAntigua = cache.keys().next().value;
    if (masAntigua === undefined) break;
    cache.delete(masAntigua);
  }
}

/** Invalida todo el cache de reportes (lo llaman los servicios que mutan datos). */
export function invalidarTodo(): void {
  cache.clear();
}

/** Ejecuta `calcular` solo si no hay entrada vigente; nunca cachea errores. */
export async function conCache<T>(
  nombre: string,
  params: Record<string, unknown>,
  calcular: () => Promise<T>,
): Promise<{ data: T; cacheHit: boolean }> {
  const clave = claveReporte(nombre, params);
  const cacheado = obtener<T>(clave);
  if (cacheado !== undefined) return { data: cacheado, cacheHit: true };
  const data = await calcular();
  guardar(clave, data);
  return { data, cacheHit: false };
}
