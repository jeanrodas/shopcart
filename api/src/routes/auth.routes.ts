import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/authenticate.js';
import { rateLimitAuth } from '../middlewares/rateLimitAuth.js';
import { registroSchema, loginSchema, refreshSchema, logoutSchema } from '../schemas/auth.schema.js';
import {
  postRegistro,
  postLogin,
  postRefresh,
  postLogout,
  getYo,
} from '../controllers/auth.controller.js';

const router = Router();

router.post('/registro', rateLimitAuth, validate({ body: registroSchema }), postRegistro);
router.post('/login', rateLimitAuth, validate({ body: loginSchema }), postLogin);
router.post('/refresh', rateLimitAuth, validate({ body: refreshSchema }), postRefresh);
router.post('/logout', validate({ body: logoutSchema }), postLogout);
router.get('/yo', authenticate, getYo);

export default router;
