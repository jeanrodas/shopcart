import type { RequestHandler } from 'express';
import * as usuariosService from '../services/usuarios.service.js';
import { UnauthorizedError } from '../errors/index.js';
import type { ListarUsuariosQuery, PerfilInput } from '../schemas/usuarios.schema.js';

export const getUsuarios: RequestHandler = async (req, res) => {
  const result = await usuariosService.listar(req.query as unknown as ListarUsuariosQuery);
  res.status(200).json(result);
};

/** Perfil del usuario autenticado (cualquier rol). */
export const getMe: RequestHandler = async (req, res) => {
  const usuario = req.usuario;
  if (!usuario) {
    throw new UnauthorizedError();
  }
  res.status(200).json(await usuariosService.obtenerPerfil(usuario.id));
};

export const putMe: RequestHandler = async (req, res) => {
  const usuario = req.usuario;
  if (!usuario) {
    throw new UnauthorizedError();
  }
  const { nombre, telefono } = req.body as PerfilInput;
  const result = await usuariosService.actualizarPerfil(usuario.id, nombre, telefono?.trim() || null);
  res.status(200).json(result);
};

export const postUsuario: RequestHandler = async (req, res) => {
  const usuario = req.usuario;
  if (!usuario) {
    throw new UnauthorizedError();
  }
  const body = req.body as {
    correo: string;
    contrasena: string;
    nombre: string;
    idRol: number;
  };
  const result = await usuariosService.crear(body, usuario.id);
  res.status(201).json(result);
};

export const patchRol: RequestHandler = async (req, res) => {
  const usuario = req.usuario;
  if (!usuario) {
    throw new UnauthorizedError();
  }
  const { id } = req.params as unknown as { id: number };
  const { idRol } = req.body as { idRol: number };
  const result = await usuariosService.cambiarRol(id, idRol, usuario.id);
  res.status(200).json(result);
};

export const patchEstado: RequestHandler = async (req, res) => {
  const usuario = req.usuario;
  if (!usuario) {
    throw new UnauthorizedError();
  }
  const { id } = req.params as unknown as { id: number };
  const { activo } = req.body as { activo: boolean };
  const result = await usuariosService.cambiarEstado(id, activo, usuario.id);
  res.status(200).json(result);
};
