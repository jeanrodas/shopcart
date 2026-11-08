import type { RequestHandler } from 'express';
import * as cuponesService from '../services/cupones.service.js';
import { UnauthorizedError } from '../errors/index.js';
import type {
  CuponInput,
  ListarCuponesQuery,
  ListarCuponesAdminQuery,
  AplicarCuponInput,
} from '../schemas/cupones.schema.js';

/** Actor que escribe (Administrador autenticado). */
function actor(req: Parameters<RequestHandler>[0]): number {
  if (!req.usuario) {
    throw new UnauthorizedError();
  }
  return req.usuario.id;
}

/** Cliente dueno del carrito. Los cupones son exclusivos de clientes autenticados. */
function clienteId(req: Parameters<RequestHandler>[0]): number {
  const id = req.carrito?.idUsuario;
  if (id === undefined) {
    throw new UnauthorizedError('Inicie sesion para aplicar cupones');
  }
  return id;
}

/* -------------------------- Cliente (carrito/cupon) ----------------------- */

export const postCuponCarrito: RequestHandler = async (req, res) => {
  const { codigo } = req.body as AplicarCuponInput;
  res.status(200).json(await cuponesService.aplicarACarrito(clienteId(req), codigo));
};

export const deleteCuponCarrito: RequestHandler = async (req, res) => {
  res.status(200).json(await cuponesService.quitarDeCarrito(clienteId(req)));
};

/** Valida un codigo contra el carrito del cliente sin guardarlo (util para el front). */
export const postValidarCupon: RequestHandler = async (req, res) => {
  const { codigo } = req.body as AplicarCuponInput;
  res.status(200).json(await cuponesService.validar(clienteId(req), codigo));
};

/* ------------------------------- Publico (tienda) ------------------------- */

/** Cupones aplicables ahora mismo, para mostrarlos en la tienda. Sin autenticacion. */
export const getCuponesVigentes: RequestHandler = async (_req, res) => {
  res.status(200).json(await cuponesService.vigentes());
};

/* ---------------------------- CRUD Administrador -------------------------- */

export const getCupones: RequestHandler = async (req, res) => {
  res.status(200).json(await cuponesService.listar(req.query as unknown as ListarCuponesQuery));
};

/** Listado de administracion con estado derivado (F8). */
export const getCuponesAdmin: RequestHandler = async (req, res) => {
  res.status(200).json(await cuponesService.listarAdmin(req.query as unknown as ListarCuponesAdminQuery));
};

/** KPIs del panel de administracion de cupones (F8). */
export const getResumenCupones: RequestHandler = async (_req, res) => {
  res.status(200).json(await cuponesService.resumenAdmin());
};

export const getCupon: RequestHandler = async (req, res) => {
  const { id } = req.params as unknown as { id: number };
  res.status(200).json(await cuponesService.obtener(id));
};

export const postCupon: RequestHandler = async (req, res) => {
  res.status(201).json(await cuponesService.crear(req.body as CuponInput, actor(req)));
};

export const putCupon: RequestHandler = async (req, res) => {
  const { id } = req.params as unknown as { id: number };
  res.status(200).json(await cuponesService.actualizar(id, req.body as CuponInput, actor(req)));
};

export const patchCuponEstado: RequestHandler = async (req, res) => {
  const { id } = req.params as unknown as { id: number };
  const { activo } = req.body as { activo: boolean };
  res.status(200).json(await cuponesService.cambiarEstado(id, activo, actor(req)));
};
