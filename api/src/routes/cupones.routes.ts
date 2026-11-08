import { Router, type RequestHandler } from 'express';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { ROLES } from '../config/roles.js';
import { idParamSchema } from '../schemas/common.schema.js';
import { estadoSchema } from '../schemas/catalogo.schema.js';
import {
  cuponSchema,
  listarCuponesSchema,
  listarCuponesAdminSchema,
} from '../schemas/cupones.schema.js';
import * as c from '../controllers/cupones.controller.js';

const router = Router();

// Publico (tienda): cupones vigentes. DEBE ir antes de las rutas de admin y antes de
// '/:id' para no quedar detras de authorize ni ser capturada por el parametro.
router.get('/vigentes', c.getCuponesVigentes);

// Gestion de cupones: exclusiva de Administrador.
const admin: RequestHandler[] = [authenticate, authorize(ROLES.Administrador)];

router.get('/', ...admin, validate({ query: listarCuponesSchema }), c.getCupones);
// F8: listado con estado derivado y KPIs. Antes de '/:id' para no caer en el parametro.
router.get('/admin', ...admin, validate({ query: listarCuponesAdminSchema }), c.getCuponesAdmin);
router.get('/resumen', ...admin, c.getResumenCupones);
router.get('/:id', ...admin, validate({ params: idParamSchema }), c.getCupon);
router.post('/', ...admin, validate({ body: cuponSchema }), c.postCupon);
router.put('/:id', ...admin, validate({ params: idParamSchema, body: cuponSchema }), c.putCupon);
router.patch(
  '/:id/estado',
  ...admin,
  validate({ params: idParamSchema, body: estadoSchema }),
  c.patchCuponEstado,
);

export default router;
