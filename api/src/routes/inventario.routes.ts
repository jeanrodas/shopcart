import { Router, type RequestHandler } from 'express';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { ROLES } from '../config/roles.js';
import { idParamSchema } from '../schemas/common.schema.js';
import {
  entradaSchema,
  ajusteSchema,
  existenciasQuerySchema,
  kardexQuerySchema,
} from '../schemas/inventario.schema.js';
import {
  postEntrada,
  postAjuste,
  getExistencias,
  getKardex,
  getConsistencia,
} from '../controllers/inventario.controller.js';

const router = Router();

router.use(authenticate);

// Operaciones de inventario: Operador o Administrador.
const gestion: RequestHandler[] = [authorize(ROLES.Operador, ROLES.Administrador)];

router.post('/entradas', ...gestion, validate({ body: entradaSchema }), postEntrada);
router.post('/ajustes', ...gestion, validate({ body: ajusteSchema }), postAjuste);
router.get('/existencias', ...gestion, validate({ query: existenciasQuerySchema }), getExistencias);
router.get(
  '/variantes/:id/kardex',
  ...gestion,
  validate({ params: idParamSchema, query: kardexQuerySchema }),
  getKardex,
);

// Auditoria del invariante: solo Administrador.
router.get('/consistencia', authorize(ROLES.Administrador), getConsistencia);

export default router;
