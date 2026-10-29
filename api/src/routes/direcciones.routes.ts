import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/authenticate.js';
import { idParamSchema } from '../schemas/common.schema.js';
import { direccionSchema } from '../schemas/direcciones.schema.js';
import {
  getDirecciones,
  postDireccion,
  getDireccion,
  putDireccion,
  deleteDireccion,
} from '../controllers/direcciones.controller.js';

const router = Router();

// Cualquier usuario autenticado gestiona SOLO sus propias direcciones.
router.use(authenticate);

router.get('/', getDirecciones);
router.post('/', validate({ body: direccionSchema }), postDireccion);
router.get('/:id', validate({ params: idParamSchema }), getDireccion);
router.put('/:id', validate({ params: idParamSchema, body: direccionSchema }), putDireccion);
router.delete('/:id', validate({ params: idParamSchema }), deleteDireccion);

export default router;
