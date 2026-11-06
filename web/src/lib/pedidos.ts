/** Logica compartida del ciclo de vida del pedido (pasos, estado y filtros del cliente). */

export interface PasoPedido {
  codigo: 'PAGADO' | 'EN_PREPARACION' | 'DESPACHADO' | 'ENTREGADO';
  texto: string;
}

/** Los 4 hitos lineales del pedido (Cancelado/Devuelto se tratan aparte). */
export const PASOS_PEDIDO: PasoPedido[] = [
  { codigo: 'PAGADO', texto: 'Pagado' },
  { codigo: 'EN_PREPARACION', texto: 'En preparación' },
  { codigo: 'DESPACHADO', texto: 'Despachado' },
  { codigo: 'ENTREGADO', texto: 'Entregado' },
];

/** Indice del paso actual dentro de PASOS_PEDIDO; -1 si el estado no es lineal. */
export function indicePaso(codigo: string): number {
  return PASOS_PEDIDO.findIndex((p) => p.codigo === codigo);
}

/** El cliente puede cancelar solo desde PAGADO o EN_PREPARACION (coincide con las
 *  transiciones a CANCELADO de rol NULL en dbo.TransicionEstadoPedido). */
export function puedeCancelar(codigo: string): boolean {
  return codigo === 'PAGADO' || codigo === 'EN_PREPARACION';
}

/**
 * Regla unica del boton "Cancelar pedido", compartida por la lista y el detalle:
 *   - PAGADO / EN_PREPARACION  -> habilitado
 *   - DESPACHADO               -> deshabilitado (ya no se puede cancelar)
 *   - ENTREGADO/CANCELADO/...  -> oculto
 */
export type AccionCancelar = 'habilitado' | 'deshabilitado' | 'oculto';
export function accionCancelar(codigo: string): AccionCancelar {
  if (puedeCancelar(codigo)) return 'habilitado';
  if (codigo === 'DESPACHADO') return 'deshabilitado';
  return 'oculto';
}

/** "En curso": aun no entregado, cancelado ni devuelto. */
export function enCurso(codigo: string): boolean {
  return codigo === 'PAGADO' || codigo === 'EN_PREPARACION' || codigo === 'DESPACHADO';
}

/** Codigos de estado que envia cada chip de filtro (lista separada por comas para la API). */
export interface FiltroEstado {
  clave: string;
  texto: string;
  codigos: string | undefined;
  /** Claves de conteo del resumen que suma el chip. */
  cuenta: (keyof ConteosResumen)[];
}

export interface ConteosResumen {
  Pagado: number;
  EnPreparacion: number;
  Despachado: number;
  Entregado: number;
  Cancelado: number;
  Devuelto: number;
  Total: number;
}

export const FILTROS_ESTADO: FiltroEstado[] = [
  { clave: 'todos', texto: 'Todos', codigos: undefined, cuenta: ['Total'] },
  {
    clave: 'en-curso',
    texto: 'En curso',
    codigos: 'PAGADO,EN_PREPARACION,DESPACHADO',
    cuenta: ['Pagado', 'EnPreparacion', 'Despachado'],
  },
  { clave: 'entregados', texto: 'Entregados', codigos: 'ENTREGADO', cuenta: ['Entregado'] },
  { clave: 'cancelados', texto: 'Cancelados', codigos: 'CANCELADO', cuenta: ['Cancelado'] },
  { clave: 'devueltos', texto: 'Devueltos', codigos: 'DEVUELTO', cuenta: ['Devuelto'] },
];
