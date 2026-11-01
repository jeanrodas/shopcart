import { Router, type RequestHandler } from 'express';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { ROLES } from '../config/roles.js';
import {
  rangoSchema,
  ventasQuerySchema,
  topProductosQuerySchema,
  carritosQuerySchema,
} from '../schemas/reportes.schema.js';
import * as c from '../controllers/reportes.controller.js';

const router = Router();

// Dashboard y reportes (RF-08): exclusivos de Administrador. El guard va en CADA
// ruta (authenticate + authorize) para que ninguna quede sin proteger.
const admin: RequestHandler[] = [authenticate, authorize(ROLES.Administrador)];

router.get('/resumen', ...admin, validate({ query: rangoSchema }), c.getResumen);
router.get('/ventas', ...admin, validate({ query: ventasQuerySchema }), c.getVentas);
router.get('/categorias', ...admin, validate({ query: rangoSchema }), c.getCategorias);
router.get('/top-productos', ...admin, validate({ query: topProductosQuerySchema }), c.getTopProductos);
router.get('/carritos-abandonados', ...admin, validate({ query: carritosQuerySchema }), c.getCarritosAbandonados);

// Exportaciones a Excel (.xlsx).
router.get('/ventas/export', ...admin, validate({ query: ventasQuerySchema }), c.getVentasExport);
router.get('/categorias/export', ...admin, validate({ query: rangoSchema }), c.getCategoriasExport);
router.get('/top-productos/export', ...admin, validate({ query: topProductosQuerySchema }), c.getTopProductosExport);

export default router;
