import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import usuariosRoutes from './usuarios.routes.js';
import direccionesRoutes from './direcciones.routes.js';
import catalogoRoutes from './catalogo.routes.js';
import inventarioRoutes from './inventario.routes.js';
import carritoRoutes from './carrito.routes.js';
import cuponesRoutes from './cupones.routes.js';
import checkoutRoutes from './checkout.routes.js';
import pedidosRoutes from './pedidos.routes.js';
import bitacoraRoutes from './bitacora.routes.js';
import reportesRoutes from './reportes.routes.js';

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
// Carrito de compras (RF-04): cliente autenticado o invitado por X-Cart-Token.
apiV1.use('/carrito', carritoRoutes);
// Cupones y promociones (RF-05): gestion por Administrador.
apiV1.use('/cupones', cuponesRoutes);
// Checkout y pago (RF-06): cliente autenticado; liberacion de reservas por Administrador.
apiV1.use('/checkout', checkoutRoutes);
// Pedidos, ciclo de vida y devoluciones (RF-07).
apiV1.use('/pedidos', pedidosRoutes);
// Bitacora de auditoria (RF-09): consulta por Administrador.
apiV1.use('/bitacora', bitacoraRoutes);
// Dashboard y reportes (RF-08): Administrador.
apiV1.use('/reportes', reportesRoutes);
router.use('/api/v1', apiV1);

export default router;
