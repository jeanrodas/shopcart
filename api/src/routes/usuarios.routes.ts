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
} from '../schemas/usuarios.schema.js';
import {
  getUsuarios,
  postUsuario,
  patchRol,
  patchEstado,
} from '../controllers/usuarios.controller.js';

const router = Router();

// Toda la gestion de usuarios es exclusiva del Administrador.
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
