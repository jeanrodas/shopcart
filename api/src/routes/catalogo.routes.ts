import { Router, type RequestHandler } from 'express';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { ROLES } from '../config/roles.js';
import { idParamSchema } from '../schemas/common.schema.js';
import {
  busquedaSchema,
  busquedaAdminSchema,
  listarCategoriasSchema,
  obtenerProductoAdminSchema,
  categoriaSchema,
  productoSchema,
  varianteSchema,
  imagenSchema,
  estadoSchema,
  imagenParamsSchema,
} from '../schemas/catalogo.schema.js';
import * as c from '../controllers/catalogo.controller.js';

const router = Router();

// Lectura de administracion: Administrador u Operador. Escritura: solo Administrador.
const lectura: RequestHandler[] = [authenticate, authorize(ROLES.Administrador, ROLES.Operador)];
const escritura: RequestHandler[] = [authenticate, authorize(ROLES.Administrador)];

/* ------------------------------ Publico (tienda) -------------------------- */
router.get('/catalogo/categorias', c.getCategoriasPublico);
router.get('/catalogo/productos', validate({ query: busquedaSchema }), c.getProductosPublico);
router.get('/catalogo/productos/:id', validate({ params: idParamSchema }), c.getProductoPublico);

/* ---------------------------- Lectura administracion ---------------------- */
router.get('/categorias', ...lectura, validate({ query: listarCategoriasSchema }), c.getCategoriasAdmin);
router.get('/productos', ...lectura, validate({ query: busquedaAdminSchema }), c.getProductosAdmin);
router.get(
  '/productos/:id',
  ...lectura,
  validate({ params: idParamSchema, query: obtenerProductoAdminSchema }),
  c.getProductoAdmin,
);

/* -------------------------------- Categorias ------------------------------ */
router.post('/categorias', ...escritura, validate({ body: categoriaSchema }), c.postCategoria);
router.put(
  '/categorias/:id',
  ...escritura,
  validate({ params: idParamSchema, body: categoriaSchema }),
  c.putCategoria,
);
router.patch(
  '/categorias/:id/estado',
  ...escritura,
  validate({ params: idParamSchema, body: estadoSchema }),
  c.patchCategoriaEstado,
);

/* --------------------------------- Productos ------------------------------ */
router.post('/productos', ...escritura, validate({ body: productoSchema }), c.postProducto);
router.put(
  '/productos/:id',
  ...escritura,
  validate({ params: idParamSchema, body: productoSchema }),
  c.putProducto,
);
router.patch(
  '/productos/:id/estado',
  ...escritura,
  validate({ params: idParamSchema, body: estadoSchema }),
  c.patchProductoEstado,
);

/* --------------------------------- Variantes ------------------------------ */
router.post(
  '/productos/:id/variantes',
  ...escritura,
  validate({ params: idParamSchema, body: varianteSchema }),
  c.postVariante,
);
router.put(
  '/variantes/:id',
  ...escritura,
  validate({ params: idParamSchema, body: varianteSchema }),
  c.putVariante,
);
router.patch(
  '/variantes/:id/estado',
  ...escritura,
  validate({ params: idParamSchema, body: estadoSchema }),
  c.patchVarianteEstado,
);

/* ---------------------------------- Imagenes ------------------------------ */
router.post(
  '/productos/:id/imagenes',
  ...escritura,
  validate({ params: idParamSchema, body: imagenSchema }),
  c.postImagen,
);
router.delete(
  '/productos/:id/imagenes/:idImagen',
  ...escritura,
  validate({ params: imagenParamsSchema }),
  c.deleteImagen,
);
router.patch(
  '/productos/:id/imagenes/:idImagen/principal',
  ...escritura,
  validate({ params: imagenParamsSchema }),
  c.patchImagenPrincipal,
);

export default router;
