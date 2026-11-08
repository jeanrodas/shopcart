/**
 * Acciones de operacion de un pedido. La LISTA de acciones permitidas la calcula la API en
 * SQL desde dbo.TransicionEstadoPedido segun el rol (campo `AccionesPermitidas`, p. ej.
 * "PREPARAR,CANCELAR"); aqui NO se replica el grafo: solo se interpreta lo que llega y se le
 * asigna su texto/estado destino para el boton de avance lineal.
 */

export type CodigoAccion = 'PREPARAR' | 'DESPACHAR' | 'ENTREGAR' | 'CANCELAR' | 'DEVOLVER';

export const ACCIONES_AVANCE = {
  PREPARAR: { estado: 'EN_PREPARACION', texto: 'Preparar →' },
  DESPACHAR: { estado: 'DESPACHADO', texto: 'Despachar →' },
  ENTREGAR: { estado: 'ENTREGADO', texto: 'Marcar entregado' },
} as const;

export type EstadoDestino = (typeof ACCIONES_AVANCE)[keyof typeof ACCIONES_AVANCE]['estado'];

/** Convierte "PREPARAR,CANCELAR" (de la API) en un conjunto de codigos. */
export function acciones(lista: string | null | undefined): Set<CodigoAccion> {
  return new Set(
    (lista ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean) as CodigoAccion[],
  );
}

/** Primer avance lineal disponible (PREPARAR -> DESPACHAR -> ENTREGAR), o null. */
export function siguienteAvance(
  lista: string | null | undefined,
): { codigo: CodigoAccion; estado: EstadoDestino; texto: string } | null {
  const set = acciones(lista);
  for (const c of ['PREPARAR', 'DESPACHAR', 'ENTREGAR'] as const) {
    if (set.has(c)) return { codigo: c, ...ACCIONES_AVANCE[c] };
  }
  return null;
}
