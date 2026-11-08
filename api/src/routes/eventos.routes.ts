import { Router } from 'express';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { ROLES } from '../config/roles.js';
import { rateLimitEventos } from '../middlewares/rateLimitEventos.js';
import { postTicket } from '../controllers/eventos.controller.js';
import { abrirFlujo, diagnosticoSSE } from '../eventos/sse.js';
import { env } from '../config/env.js';

const router = Router();

// Diagnostico solo en pruebas (NODE_ENV=test): conexiones SSE y suscriptores vivos, para
// comprobar que no quedan listeners/intervals huerfanos tras abrir y abortar conexiones.
if (env.NODE_ENV === 'test') {
  router.get('/diagnostico', diagnosticoSSE);
}

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
