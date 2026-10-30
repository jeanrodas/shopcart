import { Router, type RequestHandler } from 'express';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { idempotencyKey } from '../middlewares/idempotencyKey.js';
import { ROLES } from '../config/roles.js';
import { iniciarSchema, pagarSchema } from '../schemas/checkout.schema.js';
import {
  postIniciar,
  getResumen,
  postPagar,
  postLiberarReservas,
} from '../controllers/checkout.controller.js';

const router = Router();

// Checkout del cliente autenticado (Operador/Administrador no compran -> 403).
const cliente: RequestHandler[] = [authenticate, authorize(ROLES.Cliente)];

router.post('/iniciar', ...cliente, validate({ body: iniciarSchema }), postIniciar);
router.get('/resumen', ...cliente, getResumen);
router.post('/pagar', ...cliente, idempotencyKey, validate({ body: pagarSchema }), postPagar);

// Liberacion manual de reservas vencidas (equivale al job): solo Administrador.
router.post(
  '/reservas/liberar',
  authenticate,
  authorize(ROLES.Administrador),
  postLiberarReservas,
);

export default router;
