import { peticion } from './clienteHttp';
import type {
  FiltrosPedidosOperacion,
  PaginaPedidosOperacion,
  RespuestaPedido,
  ResumenOperacion,
} from './tipos';

function query(f: FiltrosPedidosOperacion): string {
  const qs = new URLSearchParams();
  if (f.estado) qs.set('estado', f.estado);
  if (f.texto) qs.set('texto', f.texto);
  if (f.desde) qs.set('desde', f.desde);
  if (f.hasta) qs.set('hasta', f.hasta);
  if (f.recienteDias !== undefined) qs.set('recienteDias', String(f.recienteDias));
  qs.set('pagina', String(f.pagina));
  qs.set('tamanoPagina', String(f.tamanoPagina));
  return `?${qs.toString()}`;
}

/** Listado de pedidos para operacion (Operador/Administrador). */
export function listarPedidosOperacion(filtros: FiltrosPedidosOperacion): Promise<PaginaPedidosOperacion> {
  return peticion<PaginaPedidosOperacion>(`/api/v1/pedidos${query(filtros)}`);
}

/** Pulso del flujo de pedidos para el area interna. */
export function obtenerResumenOperacion(): Promise<ResumenOperacion> {
  return peticion<ResumenOperacion>('/api/v1/pedidos/resumen-operacion');
}

/** Avance de estado (EN_PREPARACION | DESPACHADO | ENTREGADO), con comentario opcional. */
export function cambiarEstadoPedido(
  id: number,
  estado: 'EN_PREPARACION' | 'DESPACHADO' | 'ENTREGADO',
  comentario?: string,
): Promise<RespuestaPedido> {
  return peticion<RespuestaPedido>(`/api/v1/pedidos/${id}/estado`, {
    method: 'POST',
    body: comentario ? { estado, comentario } : { estado },
  });
}

/** Cancela un pedido (Operador/Admin; el SP valida la transicion permitida). */
export function cancelarPedidoOperacion(id: number, motivo: string): Promise<RespuestaPedido> {
  return peticion<RespuestaPedido>(`/api/v1/pedidos/${id}/cancelar`, {
    method: 'POST',
    body: { motivo },
  });
}

/** Registra una devolucion por lineas de un pedido ENTREGADO. */
export function registrarDevolucion(
  id: number,
  motivo: string,
  lineas: { idPedidoDetalle: number; cantidad: number }[],
): Promise<RespuestaPedido & { devolucion: unknown | null }> {
  return peticion(`/api/v1/pedidos/${id}/devoluciones`, {
    method: 'POST',
    body: { motivo, lineas },
  });
}
