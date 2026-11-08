import { Router, type RequestHandler } from 'express';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { ROLES } from '../config/roles.js';
import { rangoSchema, topProductosQuerySchema } from '../schemas/reportes.schema.js';
import { dashboardCuponesQuerySchema, dashboardHorasQuerySchema, dashboardVentasQuerySchema } from '../schemas/dashboard.schema.js';
import * as c from '../controllers/dashboard.controller.js';

const router = Router();

// Dashboard del area interna (F9). RF-01 al pie de la letra: los bloques de NEGOCIO
// (ventas, categorias, embudo, horas pico, cupones) son SOLO del Administrador; el Operador
// conserva lo operativo (top-productos, y fuera de aqui /pedidos/resumen-operacion,
// /inventario/resumen y el SSE). Pasan por el cache de M9 (X-Cache).
const soloAdmin: RequestHandler[] = [authenticate, authorize(ROLES.Administrador)];
const interno: RequestHandler[] = [authenticate, authorize(ROLES.Administrador, ROLES.Operador)];

router.get('/resumen', ...soloAdmin, validate({ query: rangoSchema }), c.getResumen);
router.get('/ventas-dia', ...soloAdmin, validate({ query: dashboardVentasQuerySchema }), c.getVentasPorDia);
router.get('/categorias', ...soloAdmin, validate({ query: rangoSchema }), c.getCategorias);
router.get('/embudo', ...soloAdmin, validate({ query: rangoSchema }), c.getEmbudo);
router.get('/horas-pico', ...soloAdmin, validate({ query: dashboardHorasQuerySchema }), c.getHorasPico);
router.get('/cupones', ...soloAdmin, validate({ query: dashboardCuponesQuerySchema }), c.getCupones);
// Top productos: tambien Operador (es operativo, no una cifra de negocio sensible).
router.get('/top-productos', ...interno, validate({ query: topProductosQuerySchema }), c.getTopProductos);

export default router;
