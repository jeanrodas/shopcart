import { peticion } from './clienteHttp';
import type { RespuestaPedido } from './tipos';

/** Un pedido del usuario autenticado (para recargar la confirmacion sin state). */
export function obtenerPedido(id: number): Promise<RespuestaPedido> {
  return peticion<RespuestaPedido>(`/api/v1/pedidos/${id}`);
}
