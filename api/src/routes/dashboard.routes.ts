import { Router, type RequestHandler } from 'express';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { ROLES } from '../config/roles.js';
import { rangoSchema, topProductosQuerySchema } from '../schemas/reportes.schema.js';
import { dashboardCuponesQuerySchema, dashboardHorasQuerySchema, dashboardVentasQuerySchema } from '../schemas/dashboard.schema.js';
import * as c from '../controllers/dashboard.controller.js';

const router = Router();

// Dashboard del area interna (F9): Administrador y Operador (este ultimo, solo lectura;
// el dashboard no tiene acciones). Guard en cada ruta. Pasan por el cache de M9 (X-Cache).
const interno: RequestHandler[] = [authenticate, authorize(ROLES.Administrador, ROLES.Operador)];

router.get('/resumen', ...interno, validate({ query: rangoSchema }), c.getResumen);
router.get('/ventas-dia', ...interno, validate({ query: dashboardVentasQuerySchema }), c.getVentasPorDia);
router.get('/categorias', ...interno, validate({ query: rangoSchema }), c.getCategorias);
router.get('/embudo', ...interno, validate({ query: rangoSchema }), c.getEmbudo);
router.get('/horas-pico', ...interno, validate({ query: dashboardHorasQuerySchema }), c.getHorasPico);
router.get('/top-productos', ...interno, validate({ query: topProductosQuerySchema }), c.getTopProductos);
router.get('/cupones', ...interno, validate({ query: dashboardCuponesQuerySchema }), c.getCupones);

export default router;
