import { Router } from 'express';
import { validate } from '../middlewares/validate.js';
import { cartIdentity } from '../middlewares/cartIdentity.js';
import { itemSchema, cantidadSchema, idVarianteParam } from '../schemas/carrito.schema.js';
import {
  getCarrito,
  postItem,
  putItem,
  deleteItem,
  deleteCarrito,
} from '../controllers/carrito.controller.js';

const router = Router();

// El carrito se identifica por la identidad (usuario autenticado o token de
// invitado), nunca por un ID en la URL. cartIdentity aplica a todas las rutas.
router.use(cartIdentity);

router.get('/', getCarrito);
router.post('/items', validate({ body: itemSchema }), postItem);
router.put('/items/:idVariante', validate({ params: idVarianteParam, body: cantidadSchema }), putItem);
router.delete('/items/:idVariante', validate({ params: idVarianteParam }), deleteItem);
router.delete('/', deleteCarrito);

export default router;
