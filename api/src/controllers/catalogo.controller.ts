import type { RequestHandler } from 'express';
import * as catalogoService from '../services/catalogo.service.js';
import { UnauthorizedError } from '../errors/index.js';
import type {
  BusquedaQuery,
  BusquedaAdminQuery,
  CategoriaInput,
  ProductoInput,
  VarianteInput,
  ImagenInput,
} from '../schemas/catalogo.schema.js';

/** Actor que escribe: siempre el usuario autenticado. */
function actor(req: Parameters<RequestHandler>[0]): number {
  const usuario = req.usuario;
  if (!usuario) {
    throw new UnauthorizedError();
  }
  return usuario.id;
}

/* ------------------------------ Lectura publica --------------------------- */

export const getCategoriasPublico: RequestHandler = async (_req, res) => {
  res.status(200).json(await catalogoService.listarCategorias(false));
};

export const getProductosPublico: RequestHandler = async (req, res) => {
  const q = req.query as unknown as BusquedaQuery;
  res.status(200).json(await catalogoService.buscarProductos(q, false));
};

export const getProductoPublico: RequestHandler = async (req, res) => {
  const { id } = req.params as unknown as { id: number };
  res.status(200).json(await catalogoService.obtenerProducto(id, false));
};

/* ----------------------------- Lectura admin ------------------------------ */

export const getCategoriasAdmin: RequestHandler = async (req, res) => {
  const { incluirInactivas } = req.query as unknown as { incluirInactivas: boolean };
  res.status(200).json(await catalogoService.listarCategorias(incluirInactivas));
};

export const getProductosAdmin: RequestHandler = async (req, res) => {
  const q = req.query as unknown as BusquedaAdminQuery;
  res.status(200).json(await catalogoService.buscarProductos(q, q.incluirInactivos));
};

export const getProductoAdmin: RequestHandler = async (req, res) => {
  const { id } = req.params as unknown as { id: number };
  const { incluirInactivos } = req.query as unknown as { incluirInactivos: boolean };
  res.status(200).json(await catalogoService.obtenerProducto(id, incluirInactivos));
};

/* ------------------------------- Categorias ------------------------------- */

export const postCategoria: RequestHandler = async (req, res) => {
  const result = await catalogoService.crearCategoria(req.body as CategoriaInput, actor(req));
  res.status(201).json(result);
};

export const putCategoria: RequestHandler = async (req, res) => {
  const { id } = req.params as unknown as { id: number };
  const result = await catalogoService.actualizarCategoria(id, req.body as CategoriaInput, actor(req));
  res.status(200).json(result);
};

export const patchCategoriaEstado: RequestHandler = async (req, res) => {
  const { id } = req.params as unknown as { id: number };
  const { activo } = req.body as { activo: boolean };
  res.status(200).json(await catalogoService.cambiarEstadoCategoria(id, activo, actor(req)));
};

/* -------------------------------- Productos ------------------------------- */

export const postProducto: RequestHandler = async (req, res) => {
  const result = await catalogoService.crearProducto(req.body as ProductoInput, actor(req));
  res.status(201).json(result);
};

export const putProducto: RequestHandler = async (req, res) => {
  const { id } = req.params as unknown as { id: number };
  const result = await catalogoService.actualizarProducto(id, req.body as ProductoInput, actor(req));
  res.status(200).json(result);
};

export const patchProductoEstado: RequestHandler = async (req, res) => {
  const { id } = req.params as unknown as { id: number };
  const { activo } = req.body as { activo: boolean };
  res.status(200).json(await catalogoService.cambiarEstadoProducto(id, activo, actor(req)));
};

/* -------------------------------- Variantes ------------------------------- */

export const postVariante: RequestHandler = async (req, res) => {
  const { id } = req.params as unknown as { id: number };
  const result = await catalogoService.crearVariante(id, req.body as VarianteInput, actor(req));
  res.status(201).json(result);
};

export const putVariante: RequestHandler = async (req, res) => {
  const { id } = req.params as unknown as { id: number };
  const result = await catalogoService.actualizarVariante(id, req.body as VarianteInput, actor(req));
  res.status(200).json(result);
};

export const patchVarianteEstado: RequestHandler = async (req, res) => {
  const { id } = req.params as unknown as { id: number };
  const { activo } = req.body as { activo: boolean };
  res.status(200).json(await catalogoService.cambiarEstadoVariante(id, activo, actor(req)));
};

/* --------------------------------- Imagenes ------------------------------- */

export const postImagen: RequestHandler = async (req, res) => {
  const { id } = req.params as unknown as { id: number };
  const result = await catalogoService.agregarImagen(id, req.body as ImagenInput, actor(req));
  res.status(201).json(result);
};

export const deleteImagen: RequestHandler = async (req, res) => {
  const { id, idImagen } = req.params as unknown as { id: number; idImagen: number };
  await catalogoService.eliminarImagen(idImagen, id, actor(req));
  res.status(200).json({ ok: true });
};

export const patchImagenPrincipal: RequestHandler = async (req, res) => {
  const { id, idImagen } = req.params as unknown as { id: number; idImagen: number };
  res.status(200).json(await catalogoService.marcarImagenPrincipal(idImagen, id, actor(req)));
};
