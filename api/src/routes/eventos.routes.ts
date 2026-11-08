import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { ROLES } from '../config/roles.js';
import { rateLimitEventos } from '../middlewares/rateLimitEventos.js';
import { postTicket } from '../controllers/eventos.controller.js';
import { abrirFlujo } from '../eventos/sse.js';

const router = Router();

// Ticket de un solo uso (60 s): Administrador u Operador, con rate limit 10/min.
router.post(
  '/ticket',
  rateLimitEventos,
  authenticate,
  authorize(ROLES.Administrador, ROLES.Operador),
  postTicket,
);

// Stream SSE: la autenticacion es el ticket consumido en el handler (no JWT en la URL),
// por eso no lleva authenticate/authorize.
router.get('/', abrirFlujo);

export default router;
