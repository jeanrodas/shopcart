import { peticion } from './clienteHttp';
import type { FiltrosPedidos, PaginaPedidos, RespuestaPedido, ResumenPedidos } from './tipos';

/** Un pedido del usuario autenticado (confirmacion y detalle). */
export function obtenerPedido(id: number): Promise<RespuestaPedido> {
  return peticion<RespuestaPedido>(`/api/v1/pedidos/${id}`);
}

/** Listado enriquecido de los pedidos del cliente, con filtros y paginacion al servidor. */
export function listarPedidos(filtros: FiltrosPedidos): Promise<PaginaPedidos> {
  const qs = new URLSearchParams();
  if (filtros.estado) qs.set('estado', filtros.estado);
  if (filtros.numero) qs.set('numero', filtros.numero);
  if (filtros.orden) qs.set('orden', filtros.orden);
  qs.set('pagina', String(filtros.pagina ?? 1));
  qs.set('tamano', String(filtros.tamano ?? 10));
  return peticion<PaginaPedidos>(`/api/v1/pedidos?${qs.toString()}`);
}

/** Resumen de "Mis pedidos" (conteos, total comprado y envio en curso). */
export function obtenerResumenPedidos(): Promise<ResumenPedidos> {
  return peticion<ResumenPedidos>('/api/v1/pedidos/resumen');
}

/** Cancela un pedido del cliente (solo si el estado lo permite; el SP valida la propiedad). */
export function cancelarPedido(id: number, motivo: string): Promise<RespuestaPedido> {
  return peticion<RespuestaPedido>(`/api/v1/pedidos/${id}/cancelar`, {
    method: 'POST',
    body: { motivo },
  });
}
