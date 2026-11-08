import type { RequestHandler } from 'express';
import * as checkoutService from '../services/checkout.service.js';
import { UnauthorizedError } from '../errors/index.js';
import type { IniciarInput, PagarInput } from '../schemas/checkout.schema.js';

/** Cliente autenticado dueno del checkout. */
function clienteId(req: Parameters<RequestHandler>[0]): number {
  if (!req.usuario) {
    throw new UnauthorizedError();
  }
  return req.usuario.id;
}

export const postIniciar: RequestHandler = async (req, res) => {
  const { idDireccion } = req.body as IniciarInput;
  res.status(201).json(await checkoutService.iniciar(clienteId(req), idDireccion));
};

export const getResumen: RequestHandler = async (req, res) => {
  res.status(200).json(await checkoutService.resumen(clienteId(req)));
};

export const postPagar: RequestHandler = async (req, res) => {
  // El pago aprobado responde 201 (Created); el rechazado 402 (Payment Required).
  // En replay se devuelve el MISMO codigo que la primera vez, deducido de aprobado.
  const result = await checkoutService.pagar(
    clienteId(req),
    req.idempotencyKey as string,
    req.body as PagarInput,
    req.usuario?.nombre ?? '',
  );
  res.status(result.aprobado ? 201 : 402).json(result);
};

export const postLiberarReservas: RequestHandler = async (_req, res) => {
  res.status(200).json(await checkoutService.liberarVencidas());
};
