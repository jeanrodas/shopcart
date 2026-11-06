import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { ROLES } from '../config/roles.js';
import { idParamSchema } from '../schemas/common.schema.js';
import {
  listarUsuariosSchema,
  crearUsuarioSchema,
  cambiarRolSchema,
  cambiarEstadoSchema,
  perfilSchema,
} from '../schemas/usuarios.schema.js';
import {
  getUsuarios,
  postUsuario,
  patchRol,
  patchEstado,
  getMe,
  putMe,
} from '../controllers/usuarios.controller.js';

const router = Router();

// Perfil propio: cualquier usuario autenticado (antes del candado de Administrador).
router.get('/me', authenticate, getMe);
router.put('/me', authenticate, validate({ body: perfilSchema }), putMe);

// El resto de la gestion de usuarios es exclusiva del Administrador.
router.use(authenticate, authorize(ROLES.Administrador));

router.get('/', validate({ query: listarUsuariosSchema }), getUsuarios);
router.post('/', validate({ body: crearUsuarioSchema }), postUsuario);
router.patch('/:id/rol', validate({ params: idParamSchema, body: cambiarRolSchema }), patchRol);
router.patch(
  '/:id/estado',
  validate({ params: idParamSchema, body: cambiarEstadoSchema }),
  patchEstado,
);

export default router;
