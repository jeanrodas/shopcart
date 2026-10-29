import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import usuariosRoutes from './usuarios.routes.js';
import direccionesRoutes from './direcciones.routes.js';

const router = Router();

router.use('/health', healthRoutes);

// Modulos de negocio bajo /api/v1.
const apiV1 = Router();
apiV1.use('/auth', authRoutes);
apiV1.use('/usuarios', usuariosRoutes);
apiV1.use('/direcciones', direccionesRoutes);
router.use('/api/v1', apiV1);

export default router;
