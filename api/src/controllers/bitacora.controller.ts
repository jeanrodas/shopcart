import type { RequestHandler } from 'express';
import * as bitacoraService from '../services/bitacora.service.js';
import type { ListarBitacoraQuery } from '../schemas/bitacora.schema.js';

export const getBitacora: RequestHandler = async (req, res) => {
  res.status(200).json(await bitacoraService.consultar(req.query as unknown as ListarBitacoraQuery));
};

export const getModulos: RequestHandler = async (_req, res) => {
  res.status(200).json(await bitacoraService.modulos());
};
