import { Router, type RequestHandler } from 'express';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { ROLES } from '../config/roles.js';
import { idParamSchema } from '../schemas/common.schema.js';
import {
  cambiarEstadoSchema,
  cancelarSchema,
  devolucionSchema,
  listarPedidosQuerySchema,
} from '../schemas/pedidos.schema.js';
import {
  getPedidos,
  getResumen,
  getPedido,
  postEstado,
  postCancelar,
  postDevolucion,
} from '../controllers/pedidos.controller.js';

const router = Router();

router.use(authenticate);

// Cualquier usuario autenticado consulta; el controlador restringe al cliente a lo suyo.
const todos: RequestHandler[] = [authorize(ROLES.Cliente, ROLES.Operador, ROLES.Administrador)];
// Gestion del ciclo de vida y devoluciones: Operador o Administrador.
const gestion: RequestHandler[] = [authorize(ROLES.Operador, ROLES.Administrador)];

router.get('/', ...todos, validate({ query: listarPedidosQuerySchema }), getPedidos);
// /resumen ANTES de /:id para que el parametro no lo capture. Solo Cliente (su propio JWT).
router.get('/resumen', authorize(ROLES.Cliente), getResumen);
router.get('/:id', ...todos, validate({ params: idParamSchema }), getPedido);

router.post('/:id/estado', ...gestion, validate({ params: idParamSchema, body: cambiarEstadoSchema }), postEstado);

// Cancelar: el cliente dueno, el Operador o el Administrador (ownership lo valida el SP).
router.post('/:id/cancelar', ...todos, validate({ params: idParamSchema, body: cancelarSchema }), postCancelar);

router.post(
  '/:id/devoluciones',
  ...gestion,
  validate({ params: idParamSchema, body: devolucionSchema }),
  postDevolucion,
);

export default router;
