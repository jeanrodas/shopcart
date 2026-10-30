import type { RequestHandler } from 'express';
import * as carritoService from '../services/carrito.service.js';
import type { ItemInput, CantidadInput } from '../schemas/carrito.schema.js';

/** Identidad del carrito resuelta por cartIdentity (usuario o invitado). */
function identidad(req: Parameters<RequestHandler>[0]): carritoService.CartIdentity {
  return req.carrito ?? {};
}

export const getCarrito: RequestHandler = async (req, res) => {
  res.status(200).json(await carritoService.obtener(identidad(req)));
};

export const postItem: RequestHandler = async (req, res) => {
  const { idVariante, cantidad } = req.body as ItemInput;
  const result = await carritoService.agregarItem(identidad(req), idVariante, cantidad);
  if (result.cartToken) {
    res.setHeader('X-Cart-Token', result.cartToken);
  }
  res.status(201).json(result);
};

export const putItem: RequestHandler = async (req, res) => {
  const { idVariante } = req.params as unknown as { idVariante: number };
  const { cantidad } = req.body as CantidadInput;
  res.status(200).json(await carritoService.actualizarItem(identidad(req), idVariante, cantidad));
};

export const deleteItem: RequestHandler = async (req, res) => {
  const { idVariante } = req.params as unknown as { idVariante: number };
  res.status(200).json(await carritoService.eliminarItem(identidad(req), idVariante));
};

export const deleteCarrito: RequestHandler = async (req, res) => {
  res.status(200).json(await carritoService.vaciar(identidad(req)));
};
