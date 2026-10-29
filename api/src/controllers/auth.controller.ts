import type { RequestHandler } from 'express';
import * as authService from '../services/auth.service.js';
import { UnauthorizedError } from '../errors/index.js';

export const postRegistro: RequestHandler = async (req, res) => {
  const { correo, contrasena, nombre } = req.body as {
    correo: string;
    contrasena: string;
    nombre: string;
  };
  const result = await authService.registro(correo, contrasena, nombre, req.ip ?? null);
  res.status(201).json(result);
};

export const postLogin: RequestHandler = async (req, res) => {
  const { correo, contrasena } = req.body as { correo: string; contrasena: string };
  const result = await authService.login(correo, contrasena, req.ip ?? null);
  res.status(200).json(result);
};

export const postRefresh: RequestHandler = async (req, res) => {
  const { refreshToken } = req.body as { refreshToken: string };
  const result = await authService.refresh(refreshToken, req.ip ?? null);
  res.status(200).json(result);
};

export const postLogout: RequestHandler = async (req, res) => {
  const { refreshToken } = req.body as { refreshToken: string };
  await authService.logout(refreshToken);
  res.status(200).json({ ok: true });
};

export const getYo: RequestHandler = async (req, res) => {
  const usuario = req.usuario;
  if (!usuario) {
    throw new UnauthorizedError();
  }
  const result = await authService.yo(usuario.id);
  res.status(200).json(result);
};
