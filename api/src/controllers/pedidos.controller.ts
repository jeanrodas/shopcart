import type { RequestHandler } from 'express';
import * as pedidosService from '../services/pedidos.service.js';
import { UnauthorizedError } from '../errors/index.js';
import { ROLES } from '../config/roles.js';
import type {
  CambiarEstadoInput,
  CancelarInput,
  DevolucionInput,
  ListarPedidosQuery,
} from '../schemas/pedidos.schema.js';

/** Usuario autenticado (id + rol). */
function actor(req: Parameters<RequestHandler>[0]): { id: number; rol: string } {
  if (!req.usuario) {
    throw new UnauthorizedError();
  }
  return { id: req.usuario.id, rol: req.usuario.rol };
}

export const getPedidos: RequestHandler = async (req, res) => {
  const { id, rol } = actor(req);
  const q = req.query as unknown as ListarPedidosQuery;
  // El cliente solo ve SUS pedidos (se ignora cualquier filtro de cliente del query).
  const idUsuario = rol === ROLES.Cliente ? id : (q.idUsuario ?? null);
  res.status(200).json(await pedidosService.listar(idUsuario, q, rol));
};

/** Resumen del cliente para "Mis pedidos" (solo Cliente; filtra por su JWT). */
export const getResumen: RequestHandler = async (req, res) => {
  const { id } = actor(req);
  res.status(200).json(await pedidosService.resumen(id));
};

export const getPedido: RequestHandler = async (req, res) => {
  const { id, rol } = actor(req);
  const { id: idPedido } = req.params as unknown as { id: number };
  const idUsuario = rol === ROLES.Cliente ? id : null;
  res.status(200).json(await pedidosService.obtener(idPedido, idUsuario));
};

export const postEstado: RequestHandler = async (req, res) => {
  const { id, rol } = actor(req);
  const { id: idPedido } = req.params as unknown as { id: number };
  const { estado, comentario } = req.body as CambiarEstadoInput;
  res.status(200).json(await pedidosService.cambiarEstado(idPedido, estado, comentario ?? null, id, rol));
};

export const postCancelar: RequestHandler = async (req, res) => {
  const { id, rol } = actor(req);
  const { id: idPedido } = req.params as unknown as { id: number };
  const { motivo } = req.body as CancelarInput;
  res.status(200).json(await pedidosService.cambiarEstado(idPedido, 'CANCELADO', motivo, id, rol));
};

export const postDevolucion: RequestHandler = async (req, res) => {
  const { id } = actor(req);
  const { id: idPedido } = req.params as unknown as { id: number };
  res.status(201).json(await pedidosService.registrarDevolucion(idPedido, req.body as DevolucionInput, id));
};
