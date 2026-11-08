import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { ROLES } from '../config/roles.js';
import { idParamSchema } from '../schemas/common.schema.js';
import {
  listarUsuariosSchema,
  listarUsuariosAdminSchema,
  crearUsuarioSchema,
  cambiarRolSchema,
  cambiarEstadoSchema,
  perfilSchema,
} from '../schemas/usuarios.schema.js';
import {
  getUsuarios,
  getUsuariosAdmin,
  postUsuario,
  postDesbloquear,
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
// F8: listado con pedidos y estado de bloqueo. Antes de las rutas con :id.
router.get('/admin', validate({ query: listarUsuariosAdminSchema }), getUsuariosAdmin);
router.post('/', validate({ body: crearUsuarioSchema }), postUsuario);
router.post('/:id/desbloquear', validate({ params: idParamSchema }), postDesbloquear);
router.patch('/:id/rol', validate({ params: idParamSchema, body: cambiarRolSchema }), patchRol);
router.patch(
  '/:id/estado',
  validate({ params: idParamSchema, body: cambiarEstadoSchema }),
  patchEstado,
);

export default router;
