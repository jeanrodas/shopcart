import { Router } from 'express';
import healthRoutes from './health.routes.js';

const router = Router();

router.use('/health', healthRoutes);

// Los modulos de negocio (catalogo, carrito, pedidos, ...) montaran sus rutas
// bajo /api/v1 en las siguientes iteraciones (M1+).
const apiV1 = Router();
router.use('/api/v1', apiV1);

export default router;
