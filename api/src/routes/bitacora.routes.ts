import { Router, type RequestHandler } from 'express';
import { validate } from '../middlewares/validate.js';
import { authenticate } from '../middlewares/authenticate.js';
import { authorize } from '../middlewares/authorize.js';
import { ROLES } from '../config/roles.js';
import { listarBitacoraSchema } from '../schemas/bitacora.schema.js';
import { getBitacora, getModulos } from '../controllers/bitacora.controller.js';

const router = Router();

// Consulta de la bitacora de auditoria: exclusiva de Administrador.
const admin: RequestHandler[] = [authenticate, authorize(ROLES.Administrador)];

router.get('/', ...admin, validate({ query: listarBitacoraSchema }), getBitacora);
router.get('/modulos', ...admin, getModulos);

export default router;
