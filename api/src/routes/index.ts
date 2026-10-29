import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import usuariosRoutes from './usuarios.routes.js';
import direccionesRoutes from './direcciones.routes.js';
import catalogoRoutes from './catalogo.routes.js';
import inventarioRoutes from './inventario.routes.js';

const router = Router();

router.use('/health', healthRoutes);

// Modulos de negocio bajo /api/v1.
const apiV1 = Router();
apiV1.use('/auth', authRoutes);
apiV1.use('/usuarios', usuariosRoutes);
apiV1.use('/direcciones', direccionesRoutes);
// Catalogo (RF-02): monta /catalogo/* (publico), /categorias, /productos y /variantes.
apiV1.use('/', catalogoRoutes);
// Inventario y kardex (RF-03).
apiV1.use('/inventario', inventarioRoutes);
router.use('/api/v1', apiV1);

export default router;
