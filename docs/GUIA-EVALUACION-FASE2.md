# Guia de evaluacion — ShopCart (Fase 2, frontend)

Esta guia es un **recorrido contado**: siga la historia en el navegador y, en cada paso,
vera **que hacer**, **que debe verse** y **que requisito demuestra**. Para la Fase 1 (API,
RF-01 a RF-09 por Postman) vea [`GUIA-EVALUACION.md`](GUIA-EVALUACION.md). Para un respaldo
por API de estos mismos recorridos, use la carpeta Postman **`00 Recorrido guiado Fase 2`**.

Tiempo total: ~45 min (los recorridos 1-3 son ~35 min; el 4 es opcional).

---

## Antes de empezar (5 min)

1. **Levante todo** siguiendo [Fase 2 — Levantar todo en una maquina limpia](../README.md#b-levantar-todo-en-una-maquina-limpia):
   base (`db/aplicar`), API (`cd api && npm run dev`, con `.env` copiado del ejemplo) y
   frontend (`cd web && npm run dev`, con `.env` copiado del ejemplo).
2. Confirme que la API responde: `GET http://localhost:3000/health` -> `db: "ok"`.
3. Abra la **tienda** en `http://localhost:5173` y el **area interna** en
   `http://localhost:5173/admin` (le pedira iniciar sesion).
4. Credenciales (datos de semilla; ver [README](../README.md#c-credenciales-de-prueba)):

   | Correo | Contrasena | Rol |
   |--------|-----------|-----|
   | `admin@shopcart.local` | `Admin123!` | Administrador |
   | `operador@shopcart.local` | `Operador123!` | Operador |
   | `cliente@shopcart.local` | `Cliente123!` | Cliente |
   | `cliente2@shopcart.local` | `Cliente123!` | Cliente (demo) |
   | `cliente3@shopcart.local` | `Cliente123!` | Cliente (demo) |

> Tip: use una **ventana de incognito** para el cliente y una normal para el area interna;
> asi tiene las dos sesiones a la vez (util en el Recorrido 2, dashboard en vivo).

---

## Recorrido 1 · Cliente (15 min)

Objetivo: comprar como invitado, crear cuenta sin perder el carrito, aplicar cupones y
completar el pago. **Empiece sin iniciar sesion** (ventana de incognito).

1. **Explorar como invitado.** Abra `http://localhost:5173/`. *Debe verse:* el Inicio con
   hero, categorias, "mas vendidos" y "ofertas de la semana". *Demuestra:* RF-02 (catalogo
   publico sin sesion) y la pantalla de Inicio (seccion 5 frontend).
2. **Buscar y filtrar.** Entre a **Catalogo** (`/catalogo`). Escriba en el buscador, elija una
   **categoria**, mueva el **rango de precio**, marque **"Solo con existencia"** y cambie el
   **orden** (p. ej. "Precio: mayor a menor"). *Debe verse:* la cuadricula y el contador de
   resultados cambian; los filtros quedan en la **URL** (recargue: se conservan). *Demuestra:*
   RF-02; filtros/orden/paginacion 100 % del lado del servidor.
3. **Ver un producto y cambiar de variante.** Abra un producto (p. ej. el **Refrigerante**, que
   tiene imagen propia por variante). Cambie la **presentacion/variante**. *Debe verse:* el
   precio y la **imagen principal** cambian con la variante (la imagen de variante aparece como
   primera miniatura, marcada "Variante"). *Demuestra:* RF-02/03; imagen por variante (F6.3).
4. **Agregar mas del disponible.** Suba la cantidad por encima de lo disponible y pulse
   **Agregar al carrito**. *Debe verse:* un mensaje de que no hay esa existencia (el tope lo
   impone la API). *Demuestra:* RF-04 (validacion de disponible en el servidor).
5. **Agregar al carrito (invitado).** Agregue 1-2 unidades de una variante disponible. *Debe
   verse:* la pastilla del carrito sube con animacion. *Demuestra:* RF-04; carrito de invitado
   por `X-Cart-Token` acunado por el servidor (sin ID en la URL).
6. **Crear cuenta — el carrito se conserva.** Vaya al carrito y pulse **Ir a pagar**; como es
   invitado lo llevara a iniciar sesion. Elija **Crear cuenta** (`/registro`) y registre un
   correo nuevo. *Debe verse:* tras registrarse, el **carrito sigue teniendo sus lineas** (se
   fusiono) y, si hubo ajustes por existencia, un aviso una sola vez. *Demuestra:* RF-01;
   fusion del carrito de invitado al entrar.
7. **Aplicar PROMO10.** En el carrito, caja **Cupon**, aplique `PROMO10`. *Debe verse:* la caja
   en verde y un **Descuento** (10 %) en el resumen; el ahorro lo calcula la BD. *Demuestra:*
   RF-05.
8. **Aplicar LUB50 (mensaje de minimo).** Quite PROMO10 y aplique `LUB50` (Q50 sobre
   *Lubricantes*, **desde Q300**). Si su carrito no llega al minimo o no es de esa categoria,
   *debe verse:* la caja en ambar con la **causa exacta** que devuelve la BD (p. ej. monto
   minimo no alcanzado). *Demuestra:* RF-05 (validacion por vigencia/categoria/minimo).
9. **Ir a pagar.** Con un cupon valido (o sin cupon), pulse **Ir a pagar** (ya como cliente).
   *Debe verse:* el **checkout de una sola pagina** con la **cuenta regresiva** de la reserva.
   *Demuestra:* RF-06 (reserva de existencia); checkout de una pagina (seccion 5).
10. **Direccion y facturacion.** Elija o cree una **direccion**; en facturacion elija **CF** o
    **NIT** (con NIT valide el formato). *Debe verse:* el resumen con Subtotal, Descuento,
    **Envio**, IVA y Total, todos de la API. *Demuestra:* RF-06; facturacion como snapshot.
11. **Simular rechazo.** En modo demo, en "Metodo de pago" elija el resultado **Rechazado** y
    pulse **Pagar**. *Debe verse:* un **modal** "No pudimos procesar el pago" con el mensaje de
    la API y la **misma cuenta regresiva**; no se creo pedido. *Demuestra:* RF-06 (pago fallido
    no genera pedido).
12. **Pago aprobado.** Cambie el resultado a **Aprobado** y pulse **Pagar** (o **Reintentar**).
    *Debe verse:* la pagina de **Confirmacion** con el **numero de pedido** (`SC-...`) y el
    total. *Demuestra:* RF-06 (pago idempotente -> pedido).
13. **Mis pedidos y detalle.** Entre a **Mis pedidos** (`/mis-pedidos`) y abra el pedido. *Debe
    verse:* la **linea de tiempo** (Pagado -> En preparacion -> Despachado -> Entregado) con
    fechas y autor, y el desglose de montos. *Demuestra:* RF-07 (seguimiento del pedido).
14. **Cancelar un pedido Pagado.** En un pedido en estado **Pagado** pulse **Cancelar pedido**,
    confirme con un motivo. *Debe verse:* el pedido pasa a **Cancelado**; la existencia y el uso
    del cupon se reponen. *Demuestra:* RF-07 (cancelacion con reposicion).

---

## Recorrido 2 · Operador (10 min)

Inicie sesion como **operador@shopcart.local**. Aterriza en `/admin` (Dashboard).

1. **Dashboard del Operador (RF-01).** En `/admin`, el Operador ve el **saludo**, el panel
   **"Ahora mismo"**, el **feed en vivo** y **Top productos** — pero **no** los bloques de
   negocio (Ventas netas, Embudo, Horas pico, Cupones): esos son solo del Administrador y ni
   siquiera se cargan (no hay `403`). El chip **"En vivo"** aparece en verde. *Demuestra:*
   RF-01 (acceso por rol al detalle); SSE (extra). El dashboard **completo** (KPIs y graficas)
   se ve en el Recorrido 3 como Administrador.
2. **Ver llegar un evento.** Deje el dashboard abierto y, en **otra ventana** (incognito),
   complete una compra como cliente (Recorrido 1, pasos 9-12). *Debe verse:* en el dashboard, el
   contador de eventos sube y el feed **"Ahora mismo"** muestra el pedido **sin recargar**.
   *Demuestra:* eventos en vivo (SSE).
3. **Cola de pedidos.** Entre a **Pedidos** (`/admin/pedidos`): la tarjeta **Pagados** entra
   seleccionada. Elija un pedido Pagado, y en el panel **Preparar** (con comentario) ->
   **Despachar** -> **Marcar entregado**. *Debe verse:* el estado avanza y el boton siguiente
   cambia en cada paso. *Demuestra:* RF-07 (maquina de estados).
4. **Devolucion parcial.** En el pedido **Entregado** pulse **Registrar devolucion**, devuelva
   **1** unidad de una linea con motivo. *Debe verse:* "Devolucion registrada"; el pedido sigue
   Entregado (fue parcial) y la existencia se repone. *Demuestra:* RF-07 (devoluciones).
5. **Inventario.** Entre a **Inventario** (`/admin/inventario`). Pulse **Entrada** en una fila:
   en el panel escriba una cantidad y una **referencia/motivo** y registre. *Debe verse:* el
   kardex del panel y la fila reflejan el movimiento. *Demuestra:* RF-03.
6. **Ajuste con motivo obligatorio y simulacion en rojo.** En el panel elija **Ajuste -** y una
   cantidad **mayor al disponible**. *Debe verse:* la vista previa en **rojo** ("42 -> ...", no
   permitido) y, si deja el **motivo** vacio, el boton **Registrar ajuste** queda
   **deshabilitado** con el mensaje "El motivo es obligatorio para un ajuste". *Demuestra:*
   RF-03 (sin stock negativo; un ajuste exige motivo).
7. **Kardex.** Abra el kardex de una variante (icono de reloj / "Ver todo"). *Debe verse:* el
   historial de movimientos con signo y existencia resultante. *Demuestra:* RF-03.
8. **Lo que el Operador NO puede hacer.** En el menu lateral **no** aparecen Bitacora ni
   Usuarios; en Productos/Categorias/Cupones no ve los botones de escritura. Si llama la API
   restringida (p. ej. `GET /bitacora`) responde **403**. *Demuestra:* control de acceso por rol
   (seccion 5).

---

## Recorrido 3 · Administrador (10 min)

Cierre sesion y entre como **admin@shopcart.local**.

1. **Crear un producto (borrador).** En **Productos** (`/admin/productos`) pulse **Nuevo
   producto**; cree uno con su categoria. *Debe verse:* aparece como **Incompleto/Oculto**
   (borrador = inactivo, sin variante activa). *Demuestra:* RF-02; estado derivado.
2. **Variantes con caracteristicas e imagen.** Agregue una **variante** (SKU, precio,
   atributos) y, con **Subir imagen**, una imagen (JPEG/PNG/WebP, <= 2 MB). *Debe verse:* la
   imagen queda asociada a la variante; **publique** activando producto y variante. *Debe verse:*
   el estado pasa a **Publicado** y el producto aparece en la tienda. *Demuestra:* RF-02; imagen
   por variante y subida por firma (F6.3).
3. **Categorias.** En **Categorias** (`/admin/categorias`) cree o edite una; vea "visibles /
   totales". *Demuestra:* RF-02.
4. **Cupones.** En **Cupones** (`/admin/cupones`) cree un cupon **general vigente** (p. ej. 10 %
   sin categoria). *Debe verse:* aparece en la tabla con su estado derivado y, en la **tienda**,
   en la cinta de ofertas / la tarjeta de cupon. *Demuestra:* RF-05.
5. **Usuarios.** En **Usuarios** (`/admin/usuarios`) pulse **Nuevo usuario interno** (Operador).
   *Debe verse:* una **contrasena temporal** mostrada **una sola vez**. Opcional: bloquee/
   desbloquee una cuenta y cambie un rol (al cambiar rol o desactivar se **revocan las sesiones**
   del usuario). *Demuestra:* RF-01 (gestion de usuarios/roles).
6. **Bitacora.** En **Bitacora** (`/admin/bitacora`) busque el cambio de precio que hizo en el
   paso 2 (filtro por tabla *Variante* / accion *MODIFICAR*, o por texto). Abra el detalle.
   *Debe verse:* el **diff Antes/Despues** con las claves cambiadas resaltadas; no hay editar ni
   borrar (inmutable). *Demuestra:* RF-09.
7. **Consistencia del kardex.** En **Inventario** pulse **Verificar consistencia**. *Debe verse:*
   "Existencia = Sigma kardex en todas las variantes". *Demuestra:* RF-03 (invariante de stock).
8. **Exportar Excel.** En el **Dashboard**, en "Ventas por dia" (o categorias / top) pulse
   **Exportar Excel**. *Debe verse:* se descarga un `.xlsx`. *Demuestra:* exportacion (extra).
9. **Cache (X-Cache).** En las **DevTools** (pestana Red), recargue el dashboard y mire la
   cabecera **`X-Cache`** de `/dashboard/resumen`: la primera lectura es **MISS**, la siguiente
   **HIT** (y vuelve a MISS tras una compra, por la invalidacion por evento). *Demuestra:* cache
   de reportes (extra).

---

## Recorrido 4 · Casos borde (opcional, 10 min)

1. **Dos clientes por la ultima unidad.** Con la API arriba, desde `cd api`:
   `BASE_URL=http://localhost:3000 npm run test:concurrencia` (10 clientes por 1 unidad: **1x201
   / 9x409**), o hagalo en **dos navegadores** llevando ambos al pago de la misma ultima unidad.
   *Demuestra:* RF-06 (reserva atomica, sin sobreventa).
2. **Doble clic en Pagar (idempotencia).** En el checkout, pulse **Pagar** dos veces rapido (o
   recargue tras aprobar). *Debe verse:* un **solo** pedido; el reintento devuelve el mismo
   (`replay`). *Demuestra:* RF-06 (Idempotency-Key).
3. **Reserva vencida.** Inicie el checkout y **espere** a que la cuenta regresiva llegue a 0 (o
   baje `RESERVA_MINUTOS` en `dbo.Parametro`). *Debe verse:* la pantalla "Tu reserva vencio" con
   **Reservar de nuevo y continuar**. *Demuestra:* RF-06.
4. **Token expirado y renovacion transparente.** Reduzca `JWT_ACCESS_EXPIRES` (p. ej. `1m`) en
   `api/.env` y reinicie la API; navegue tras expirar el access. *Debe verse:* la app **no** lo
   saca a login: renueva con `/auth/refresh` (single-flight) y sigue. *Demuestra:* sesion segura
   (seccion 5).
5. **403 al manipular IDs en la URL.** Como cliente, intente `/mis-pedidos/<id ajeno>` o, como
   Operador, llame `GET /bitacora`. *Debe verse:* **No encontrado** (404 uniforme en pedidos
   ajenos) o **403**. *Demuestra:* autorizacion por identidad/rol, nunca por ID en la URL.

---

## Mapa requisito -> donde verlo

| Requisito | Donde verlo (recorrido · paso) |
|-----------|--------------------------------|
| RF-01 Auth/usuarios | R1·6 (registro + fusion), R3·5 (usuarios/roles), R4·4 (renovacion) |
| RF-02 Catalogo | R1·1-3 (publico, filtros, variantes), R3·1-3 (productos/categorias) |
| RF-03 Inventario/kardex | R2·5-7 (entrada, ajuste con motivo, kardex), R3·7 (consistencia) |
| RF-04 Carrito | R1·4-5 (disponible, carrito de invitado) |
| RF-05 Cupones | R1·7-8 (PROMO10, LUB50), R3·4 (crear y verlo en la tienda) |
| RF-06 Checkout/pago | R1·9-12 (reserva, rechazo, aprobado), R4·1-3 (concurrencia, idempotencia, reserva) |
| RF-07 Pedidos/devoluciones | R1·13-14 (linea de tiempo, cancelar), R2·3-4 (estados, devolucion) |
| RF-08 Dashboard/reportes | R2·1 (KPIs/graficas), R3·8-9 (export, cache) |
| RF-09 Bitacora | R3·6 (diff e inmutabilidad), R2·8 (403 al Operador) |
| Seccion 5 (frontend) | Checkout de una pagina (R1·9), rutas por rol (R2·8, R4·5), sesion/renovacion (R4·4), estados carga/vacio/error y responsive (toda la UI) |
| Extras | Rate limiting (Postman `Manual`), cache X-Cache (R3·9), export Excel (R3·8), SSE en vivo (R2·1-2) |

---

## Respaldo por API (Postman)

La carpeta **`00 Recorrido guiado Fase 2`** de `docs/postman/ShopCart.postman_collection.json`
trae 15 requests (solo lectura / idempotentes) que respaldan estos recorridos: login por rol,
perfil, catalogo e inventario **ordenados en el servidor**, simulacion de ajuste no permitido,
resumen de operacion, dashboard con `X-Cache` MISS/HIT y granularidad SEMANA, ticket SSE
(201 admin / 403 cliente), cupones admin y el 403 de bitacora al Operador. Corrala con:

```bash
npx --yes newman run docs/postman/ShopCart.postman_collection.json \
  --folder "00 Recorrido guiado Fase 2" --env-var baseUrl=http://localhost:3000
```

Para la verificacion **exhaustiva** de la API (M1-M9 + todas las carpetas `F2 *`), vea
[`docs/postman/README.md`](postman/README.md) y [`GUIA-EVALUACION.md`](GUIA-EVALUACION.md).
