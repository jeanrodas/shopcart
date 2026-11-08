import type { RequestHandler } from 'express';
import { emitirTicket } from '../eventos/sse.js';
import { UnauthorizedError } from '../errors/index.js';

/**
 * POST /eventos/ticket : entrega un ticket de un solo uso para abrir el stream SSE
 * sin exponer el JWT en la URL. authorize ya garantizo Administrador/Operador.
 */
export const postTicket: RequestHandler = (req, res) => {
  if (!req.usuario) throw new UnauthorizedError();
  res.status(201).json({ ticket: emitirTicket(req.usuario.id, req.usuario.rol) });
};
