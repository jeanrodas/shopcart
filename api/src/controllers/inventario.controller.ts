import type { RequestHandler } from 'express';
import * as inventarioService from '../services/inventario.service.js';
import { UnauthorizedError } from '../errors/index.js';
import type {
  EntradaInput,
  AjusteInput,
  ExistenciasQuery,
  KardexQuery,
} from '../schemas/inventario.schema.js';

function actor(req: Parameters<RequestHandler>[0]): number {
  const usuario = req.usuario;
  if (!usuario) {
    throw new UnauthorizedError();
  }
  return usuario.id;
}

export const postEntrada: RequestHandler = async (req, res) => {
  const result = await inventarioService.registrarEntrada(req.body as EntradaInput, actor(req));
  res.status(201).json(result);
};

export const postAjuste: RequestHandler = async (req, res) => {
  const result = await inventarioService.registrarAjuste(req.body as AjusteInput, actor(req));
  res.status(201).json(result);
};

export const getExistencias: RequestHandler = async (req, res) => {
  const result = await inventarioService.listarExistencias(req.query as unknown as ExistenciasQuery);
  res.status(200).json(result);
};

export const getKardex: RequestHandler = async (req, res) => {
  const { id } = req.params as unknown as { id: number };
  const result = await inventarioService.listarKardex(id, req.query as unknown as KardexQuery);
  res.status(200).json(result);
};

export const getConsistencia: RequestHandler = async (_req, res) => {
  const result = await inventarioService.verificarConsistencia();
  res.status(200).json(result);
};
