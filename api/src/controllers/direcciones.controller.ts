import type { RequestHandler } from 'express';
import * as direccionesService from '../services/direcciones.service.js';
import { UnauthorizedError } from '../errors/index.js';
import type { DireccionInput } from '../schemas/direcciones.schema.js';

export const getDirecciones: RequestHandler = async (req, res) => {
  const usuario = req.usuario;
  if (!usuario) {
    throw new UnauthorizedError();
  }
  const result = await direccionesService.listar(usuario.id);
  res.status(200).json(result);
};

export const postDireccion: RequestHandler = async (req, res) => {
  const usuario = req.usuario;
  if (!usuario) {
    throw new UnauthorizedError();
  }
  const result = await direccionesService.crear(usuario.id, req.body as DireccionInput, usuario.id);
  res.status(201).json(result);
};

export const getDireccion: RequestHandler = async (req, res) => {
  const usuario = req.usuario;
  if (!usuario) {
    throw new UnauthorizedError();
  }
  const { id } = req.params as unknown as { id: number };
  const result = await direccionesService.obtener(id, usuario.id);
  res.status(200).json(result);
};

export const putDireccion: RequestHandler = async (req, res) => {
  const usuario = req.usuario;
  if (!usuario) {
    throw new UnauthorizedError();
  }
  const { id } = req.params as unknown as { id: number };
  const result = await direccionesService.actualizar(
    id,
    usuario.id,
    req.body as DireccionInput,
    usuario.id,
  );
  res.status(200).json(result);
};

export const deleteDireccion: RequestHandler = async (req, res) => {
  const usuario = req.usuario;
  if (!usuario) {
    throw new UnauthorizedError();
  }
  const { id } = req.params as unknown as { id: number };
  await direccionesService.desactivar(id, usuario.id, usuario.id);
  res.status(200).json({ ok: true });
};
