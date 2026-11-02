# Guia de evaluacion — ShopCart (Fase 1)

Esta guia es el punto de partida para evaluar ShopCart.

---

## Prerrequisitos (2 minutos)

Siga los pasos 1 a 5 de "Instalacion" en el [README](../README.md). En resumen, antes de
abrir esta guia debe tener:

1. **Base aplicada** con `db/aplicar.ps1` (incluye las semillas `099`): deja las 26 tablas,
   los procedimientos y los datos de demo.
2. **API arriba** (`cd api && npm run dev`) con `.env` copiado de `api/.env.example`: la
   plantilla ya trae `PAGO_SIMULADO=true` y los `RATE_LIMIT_*_MAX=100` para evaluacion.
   Verifique `GET http://localhost:3000/health` -> `db: "ok"`.
3. **Coleccion importada** en Postman: `docs/postman/ShopCart.postman_collection.json`
   (boton **Import**). Ajuste la variable **`baseUrl`** si la API no corre en
   `http://localhost:3000`.

Credenciales de semilla para el primer login:

| Correo | Contrasena | Rol |
|--------|-----------|-----|
| `admin@shopcart.local` | `Admin123!` | Administrador |
| `operador@shopcart.local` | `Operador123!` | Operador |
| `cliente@shopcart.local` | `Cliente123!` | Cliente |

## Como leer los resultados

- **Un request:** pulse **Send**; mire el **status** (arriba a la derecha) y la pestana
  **Body** de la respuesta.
- **Asserts:** la pestana **Test Results** muestra cada verificacion en verde (**PASS**) o
  rojo (**FAIL**). Cada request de esta coleccion trae sus asserts de status y de campos.
- **Varios a la vez:** use el **Collection Runner** (boton **Run**) sobre una carpeta o
  sobre toda la coleccion; al terminar lista cada request con sus PASS/FAIL. Todo en verde =
  modulo correcto.

---

## 1. Que vas a ver en 10 minutos

Abra la carpeta **`00 Recorrido guiado`** y ejecute sus requests con **Send**, de arriba
hacia abajo (o seleccione solo esa carpeta en el Collection Runner). Es **repetible**:
cada corrida usa un sufijo y una clave de idempotencia nuevos. Cuenta la historia
completa de una compra y su post-venta. Nombres **exactos** de los requests:

| # | Request (en `00 Recorrido guiado`) | Que demuestra | Respuesta esperada | RF |
|---|------------------------------------|---------------|--------------------|----|
| 01 | `01 Login admin (setup)` | Login de Administrador; fija sufijo y clave de la corrida | `200`; `accessToken` | RF-01 |
| 02 | `02 Login operador (setup)` | Login de Operador | `200`; `accessToken` | RF-01 |
| 03 | `03 Registro de cliente (RF-01)` | Alta de cliente nuevo (correo con sufijo) | `201`; `usuario.rol = "Cliente"`, `accessToken` | RF-01 |
| 04 | `04 Catalogo publico: buscar productos (RF-02)` | Catalogo **sin token**, solo disponibles | `200`; `filas[].HayDisponible = true` | RF-02 |
| 05 | `05 Ver detalle y variante disponible (RF-02/03)` | Detalle con variantes y disponible (existencia - reservas) | `200`; una variante con `Disponible >= 2` | RF-02/03 |
| 06 | `06 Cliente crea direccion (RF-01)` | Direccion del cliente | `201`; `IDDireccion` | RF-01 |
| 07 | `07 Agregar 2 al carrito (RF-04)` | Carrito del cliente con validacion de disponible | `201` | RF-04 |
| 08 | `08 Aplicar cupon PROMO10 (RF-05)` | Cupon 10% sobre el subtotal | `200`; `cupon.Codigo = "PROMO10"`, `totales.Descuento > 0` | RF-05 |
| 09 | `09 Iniciar checkout: reserva (RF-06)` | Reserva de existencia por N minutos | `201`; `resumen.ExpiraEn` presente | RF-06 |
| 10 | `10 Pagar con Idempotency-Key (RF-06)` | Pago simulado idempotente -> crea el pedido | `201`; `aprobado = true`, `pedido.NumeroPedido` = `SC-...` | RF-06 |
| 11 | `11 Repetir el pago: replay idempotente (RF-06)` | Reintento con la **misma** `Idempotency-Key` | `201`; `replay = true`, mismo `NumeroPedido` | RF-06 |
| 12 | `12 Operador: PAGADO -> EN_PREPARACION (RF-07)` | Avance de estado valido por el grafo | `200`; `pedido.EstadoCodigo = "EN_PREPARACION"` | RF-07 |
| 13 | `13 Operador: EN_PREPARACION -> DESPACHADO (RF-07)` | Siguiente transicion | `200` | RF-07 |
| 14 | `14 Operador: DESPACHADO -> ENTREGADO (RF-07)` | Llega a ENTREGADO (habilita devolucion) | `200` | RF-07 |
| 15 | `15 Operador: devolucion parcial 1 de 2 (RF-07)` | Devuelve 1 de 2 unidades; repone inventario | `201`; `pedido.EstadoCodigo = "ENTREGADO"` (sigue, es parcial) | RF-07 |
| 16 | `16 Admin: bitacora del pedido ?modulo=PEDIDOS (RF-09)` | Auditoria del pedido | `200`; fila `PAGADO->EN_PREPARACION` y fila de la devolucion (`IDDevolucion`) | RF-09 |
| 17 | `17 Admin: resumen de reportes (RF-08)` | Dashboard: KPIs del periodo | `200`; `Pedidos >= 1`, `VentaNeta`, `VariantesBajoStock` | RF-08 |

> **Sobre la devolucion (paso 15):** el recorrido crea y conduce **su propio** pedido
> hasta `ENTREGADO` y devuelve 1 de 2 unidades, para que la narrativa sea **repetible**
> (no muta datos de semilla). Si quiere ver devoluciones ya sembradas, en los datos de
> `099`: el pedido con clave `SEED-008` quedo `ENTREGADO` con una **devolucion parcial**, y
> `SEED-009` con una **devolucion total** (paso a `DEVUELTO`). Se consultan en la carpeta
> **M9 Reportes** / **M7 Pedidos** o por bitacora `?modulo=PEDIDOS`.

Para la verificacion **exhaustiva** (todos los casos felices y negativos de cada modulo)
corra la coleccion completa; el recorrido es la **narrativa**, no el reemplazo de esa
verificacion (ver seccion 3).

---

## 2. Mapa RF -> evidencia

| RF | Que pide el enunciado | Carpeta Postman | Requests clave | Como se verifica |
|----|-----------------------|-----------------|----------------|------------------|
| RF-01 Auth/usuarios | Registro/login con roles; sesiones seguras | `Auth`, `Usuarios (Administrador)`, `Direcciones (Cliente)`, `Casos negativos` | login/registro/refresh; cambiar rol/estado; refresh reutilizado | Postman (asserts de status/tokens); respuestas uniformes `401`/`404` |
| RF-02 Catalogo | Categorias/productos/variantes con atributos e imagenes | `M2 Catalogo` | buscar publico, detalle, crear producto/variante | Postman; inactivos no listan en publico (404) |
| RF-03 Inventario/kardex | Existencia con kardex; sin stock negativo | `M3 Inventario` | entrada, ajuste, kardex, consistencia | Postman + `GET /inventario/consistencia` (`consistente:true`) |
| RF-04 Carrito | Carrito de cliente e invitado; totales/IVA | `M4 Carrito` | agregar/actualizar/quitar; fusion al login | Postman; totales calculados en SQL |
| RF-05 Cupones | Validacion (vigencia, limites, categoria) | `M5 Cupones` | aplicar PROMO10/LUB50; vencido/futuro/agotado | Postman (cada causa de invalidez) |
| RF-06 Checkout/pago | Reserva + pago idempotente | `M6 Checkout`, recorrido 09-11 | iniciar, pagar, replay | Postman + `npm run test:concurrencia` |
| RF-07 Pedidos/devoluciones | Maquina de estados; devoluciones | `M7 Pedidos`, recorrido 12-15 | avanzar, cancelar, devolucion parcial/total | Postman; `TR_Pedido_TransicionValida` como respaldo en BD |
| RF-08 Dashboard/reportes | Ventas, top, abandonados, comparativo | `M9 Reportes`, recorrido 17 | resumen, ventas, categorias, top, carritos | Postman + `npm run test:rendimiento`; datos de semilla |
| RF-09 Bitacora | Auditoria inmutable con usuario | `M8 Bitacora`, recorrido 16 | consulta por modulo; 403 a no-admin | Postman; inmutabilidad por SQL (DENY + trigger) |
| Extra: rate limiting | — | `Casos negativos`, `Manual (rate limit)` | Login x11 -> 429 | Postman (carpeta Manual, con limites por defecto) |
| Extra: cache de reportes | — | `M9 Reportes` | resumen MISS->HIT; invalidacion por evento | Postman (header `X-Cache`) |
| Extra: export a Excel | — | `M9 Reportes` | `/reportes/ventas/export` | Postman (Content-Type/Disposition xlsx) |

---

## 3. Pruebas automatizadas

Con la API arriba (variables de evaluacion; ver README):

- **Coleccion completa (verificacion exhaustiva).** Narra y **comprueba** cada modulo con
  sus asserts:
  ```bash
  npx newman run docs/postman/ShopCart.postman_collection.json --env-var baseUrl=http://localhost:3000
  ```
  Esperado: todas las iteraciones/requests/asserts en verde, `exit 0`. (La carpeta
  `Manual (rate limit)` esta dentro; con `RATE_LIMIT_AUTH_MAX=100` no dispara 429.)
- **Concurrencia del checkout** (`api/`):
  `BASE_URL=http://localhost:3000 npm run test:concurrencia` -> **7/7** escenarios
  (1x201/9x409, replay, consistencia, 402->201, reuso de clave 409), `exit 0`.
- **Rendimiento de reportes** (`api/`):
  `BASE_URL=http://localhost:3000 npm run test:rendimiento`. Para medir el SP puro,
  arranque la API con `REPORTES_CACHE_TTL_SEGUNDOS=0` (ver README); reporta p50/p95/max,
  `exit 0` si p95 < 1000 ms y **`exit 2`** si detecta `X-Cache: HIT` en la fase base.

El **recorrido** (seccion 1) es la narrativa guiada; la **coleccion completa** es la
verificacion que cubre los casos negativos y de borde de cada RF.

---

## 4. Que mirar en el codigo (para la defensa)

| Archivo : punto | Por que importa |
|-----------------|-----------------|
| `api/src/data/spExecutor.ts` : `executeSp` | Unico acceso a datos: `request.execute(sp)` tipado; no hay SQL en TypeScript. |
| `db/scripts/016_SP_Checkout.sql` : `SP_Pedidos_CrearPedido` | Pago idempotente (UNIQUE de clave), pre-bloqueo de variantes y consumo de reservas, todo atomico. |
| `db/scripts/018_SP_Pedidos.sql` : `TR_Pedido_TransicionValida` | Respaldo en BD del grafo de estados: rechaza una transicion invalida aunque no pase por el SP. |
| `api/src/utils/reportesCache.ts` : `conCache` / `invalidarTodo` | Cache de reportes con versionado + single-flight; se invalida por evento desde los servicios que mutan ventas/inventario. |
| `api/src/services/auth.service.ts` : `login` / `intentosBloqueado` | Lockout en dos capas (memoria por correo+IP y contador por cuenta en BD) + respuesta uniforme 401. |
| `db/scripts/019_Bitacora.sql` : `TR_*_Bitacora` | Auditoria por modulo; el autor sale de `SESSION_CONTEXT(N'IDUsuario')` que fija cada SP de escritura. |
| `api/src/middlewares/cartIdentity.ts` : `cartIdentity` | Identidad del carrito: usuario autenticado o token de invitado; nunca un ID en la URL. |
| `db/scripts/020_Reportes.sql` : `VW_Reportes_PedidoNeto` / `SP_Reportes_Resumen` | Venta neta (descuenta devoluciones) y comparativo con el periodo anterior; rangos semiabiertos. |
| `db/scripts/017_Migracion_CarritoTokenUnico.sql` | Indice unico filtrado para el token de invitado (tolera multiples NULL): decision de modelado explicada. |
| `db/aplicar.ps1` / `aplicar.sh` : `$orden` | Orden canonico unico (una sola lista); `012` despues de `013`/`014`. |

---

## 5. Ambiente desplegado

La API corre en **https://jeanrodas.lat** (Docker Compose + Caddy con HTTPS; ver
`deploy/README.md`):

- `https://jeanrodas.lat/health` -> estado del servicio y de la BD.
- `https://jeanrodas.lat/api-docs` -> Swagger (OpenAPI 3).
- `https://jeanrodas.lat/` -> metadatos (nombre, version, fase, enlaces).

El ambiente publico corre en **modo demo** (`NODE_ENV=production` + `MODO_DEMO=true` +
`PAGO_SIMULADO=true`, con los `RATE_LIMIT_*_MAX=100`), de modo que el evaluador puede
elegir el desenlace del pago (`simularResultado`) y correr muchas peticiones. Un ambiente
real, en cambio, usa `MODO_DEMO=false`, `PAGO_SIMULADO=false` y los limites por defecto
(ver `deploy/README.md`).

Para evaluar contra el ambiente desplegado, cambie la variable `baseUrl` de la coleccion a
`https://jeanrodas.lat`. Como corre en modo demo (limites en 100), tanto el **recorrido
guiado** como la **coleccion completa** se pueden ejecutar ahi sin topar el rate limit.

---

## Si algo falla

| Sintoma | Causa probable | Que hacer |
|---------|----------------|-----------|
| `429 Too Many Requests` | Rate limit: esta corriendo con los limites por defecto (10/20/10), no con los de evaluacion | Arranque la API con los `RATE_LIMIT_*_MAX=100` de `api/.env.example`. "Login x11" (`Manual`) **debe** dar 429: ahi es lo esperado. |
| `404` en el catalogo publico | Las semillas `099` no se aplicaron | Reaplique la base con `db/aplicar.ps1` **sin** `-IncluirSemillas:$false`. |
| `401 Unauthorized` donde antes funcionaba | El `accessToken` expiro (dura 15 min) | Vuelva a correr el login de la carpeta (o el `01 Login` del recorrido): los requests re-capturan el token. |
| `409 Conflict` al iniciar checkout | La variante quedo sin disponible (reservas o compras previas) | Use una corrida nueva (las carpetas repetibles toman una variante/sufijo frescos) o reaplique las semillas. |
