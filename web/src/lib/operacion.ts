/** Logica de operacion de pedidos (transiciones por estado para el area interna). */

export type EstadoDestino = 'EN_PREPARACION' | 'DESPACHADO' | 'ENTREGADO';

export interface SiguientePaso {
  estado: EstadoDestino;
  texto: string;
}

/**
 * Siguiente avance lineal permitido para Operador/Administrador, segun el grafo de
 * dbo.TransicionEstadoPedido (015). La API expone las transiciones solo como tabla
 * interna (no hay endpoint), por eso aqui se replica el texto fijo. ENTREGADO no avanza
 * por aqui: su unica salida es una devolucion. CANCELADO/DEVUELTO son terminales.
 */
export function siguientePaso(estado: string): SiguientePaso | null {
  switch (estado) {
    case 'PAGADO':
      return { estado: 'EN_PREPARACION', texto: 'Preparar →' };
    case 'EN_PREPARACION':
      return { estado: 'DESPACHADO', texto: 'Despachar →' };
    case 'DESPACHADO':
      return { estado: 'ENTREGADO', texto: 'Marcar entregado' };
    default:
      return null;
  }
}

/** Cancelacion permitida (mismas transiciones a CANCELADO del grafo): PAGADO o EN_PREPARACION. */
export function puedeCancelarOperacion(estado: string): boolean {
  return estado === 'PAGADO' || estado === 'EN_PREPARACION';
}

/** Un pedido ENTREGADO admite registrar devoluciones por linea. */
export function puedeDevolver(estado: string): boolean {
  return estado === 'ENTREGADO';
}
