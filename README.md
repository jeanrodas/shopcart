# ShopCart

Plataforma de e-commerce.

## Descripcion

Pendiente.

## Stack

Pendiente.

## Requisitos

Pendiente.

## Instalacion

Monorepo simple: la base de datos vive en `db/` y el backend en `api/`.

### 1. Base de datos

Requiere SQL Server 2019+. Ejecutar los scripts de `db/scripts/` **en orden**
sobre una instancia limpia (ver `db/README.md`):

```bash
sqlcmd -S localhost -U sa -P "<password>" -i db/scripts/001_CreateDatabase.sql
sqlcmd -S localhost -U sa -P "<password>" -i db/scripts/002_SP_Sistema_Ping.sql
```

### 2. API

Requiere Node.js 24 LTS.

```bash
cd api
cp .env.example .env     # luego edite .env con sus valores reales
npm install
npm run dev              # desarrollo con recarga (tsx watch)
```

Otros scripts:

```bash
npm run build   # compila TypeScript a dist/
npm start       # ejecuta la build (node dist/server.js)
npm run lint    # ESLint
npm run format  # Prettier
```

La API queda disponible en `http://localhost:3000` (segun `PORT`):

- `GET /health` — estado del servicio y de la BD.
- `GET /api-docs` — documentacion Swagger (OpenAPI 3).

## Variables de entorno

Se definen en `api/.env` (plantilla en `api/.env.example`). La aplicacion valida
estas variables al arrancar con zod y **no inicia** si falta alguna o es invalida.

| Variable | Descripcion | Ejemplo |
|----------|-------------|---------|
| `NODE_ENV` | Entorno de ejecucion | `development` |
| `PORT` | Puerto HTTP de la API | `3000` |
| `LOG_LEVEL` | Nivel de log de pino (`trace`..`fatal`, `silent`) | `info` |
| `DB_SERVER` | Host de SQL Server | `localhost` |
| `DB_PORT` | Puerto de SQL Server | `1433` |
| `DB_NAME` | Nombre de la base de datos | `ShopCart` |
| `DB_USER` | Usuario de SQL Server | `shopcart_app` |
| `DB_PASSWORD` | Contrasena de SQL Server | `ShopCart_Dev_2026!` |
| `DB_ENCRYPT` | Cifrar la conexion (`true`/`false`) | `true` |
| `DB_TRUST_SERVER_CERT` | Confiar en el certificado del servidor | `true` |
| `DB_REQUEST_TIMEOUT_MS` | Timeout de cada request a SQL Server (ms) | `30000` |
| `CORS_ORIGIN` | Origenes permitidos (separados por coma) | `http://localhost:5173` |
| `JWT_ACCESS_SECRET` | Secreto del access token (min. 32 chars) | `...` |
| `JWT_REFRESH_SECRET` | Secreto del refresh token (min. 32 chars) | `...` |
| `JWT_ACCESS_EXPIRES` | Vigencia del access token | `15m` |
| `JWT_REFRESH_EXPIRES` | Vigencia del refresh token | `7d` |
| `RESERVA_MINUTOS` | Minutos de vigencia de una reserva de stock | `15` |
| `CARRITO_ABANDONO_HORAS` | Horas para considerar un carrito abandonado | `24` |
| `IVA_PORCENTAJE` | Porcentaje de IVA aplicado | `12` |
| `RATE_LIMIT_CHECKOUT_MAX` | Operaciones de checkout por usuario por minuto | `20` |
| `PAGO_SIMULADO` | Pago simulado (solo desarrollo/demo); `false` obligatorio en produccion | `true` |

## Scripts de base de datos

Se ejecutan **en orden ascendente** sobre una instancia limpia (detalle en
`db/README.md`):

| Script | Descripcion |
|--------|-------------|
| `001_CreateDatabase.sql` | Base de datos `ShopCart` y modelo relacional (26 tablas). |
| `002_SP_Sistema_Ping.sql` | `dbo.SP_Sistema_Ping` para `/health`. |
| `003_Security.sql` | Login `shopcart_app` (solo `EXECUTE`) y bitacora inmutable. |
| `004_Catalogos.sql` | Roles, tipos de movimiento de inventario, parametros, indice de usuarios. |
| `005_SP_Auth.sql` | SPs de autenticacion (registro, login, refresh tokens). |
| `006_SP_Usuarios.sql` | SPs de gestion de usuarios (Administrador). |
| `007_SP_Direcciones.sql` | SPs de direcciones del usuario. |
| `008_VW_Inventario.sql` | Vista de inventario disponible, indice de busqueda y TVP de atributos. |
| `009_SP_Categorias.sql` | SPs de categorias del catalogo (RF-02). |
| `010_SP_Catalogo.sql` | SPs de productos, variantes e imagenes (RF-02). |
| `011_SP_Inventario.sql` | SPs de inventario y kardex (RF-03). |
| `012_SP_Carrito.sql` | Funcion de totales y SPs del carrito de compras (RF-04). En M5 la funcion de totales pasa a descontar el cupon, por eso se reaplica despues de `014`. |
| `013_Migracion_CarritoCupon.sql` | Migracion posterior al `001`: agrega `Carrito.IDCupon` y su FK para recordar el cupon aplicado antes del checkout (RF-05). |
| `014_SP_Cupones.sql` | Funciones (`FU_Cupones_CalculoDescuento`, `FU_Cupones_Estado`) y SPs de cupones: validar/aplicar/quitar y CRUD de administracion (RF-05). |
| `015_Catalogo_EstadosPedido.sql` | Estados de pedido y transiciones permitidas; base del ciclo de vida (RF-06, RF-07). Idempotente. |
| `016_SP_Checkout.sql` | Reserva de existencia, checkout en dos pasos, pago simulado idempotente y creacion de pedido (RF-06): `SP_Inventario_ReservarExistencia`, `SP_Checkout_Iniciar`/`_Resumen`, `SP_Pedidos_CrearPedido`, `SP_Checkout_LiberarReservasVencidas`. |
| `017_Migracion_CarritoTokenUnico.sql` | Migracion posterior al `001`: cambia la unicidad del token de invitado a un indice unico filtrado para tolerar multiples NULL (RF-06). |
| `018_SP_Pedidos.sql` | Pedidos (RF-07): ciclo de vida (`SP_Pedidos_CambiarEstado`), devoluciones (`SP_Pedidos_RegistrarDevolucion` con `TVP_DevolucionLinea`), consulta (`SP_Pedidos_Obtener`), listado (`SP_Pedidos_Listar`) y el trigger `TR_Pedido_TransicionValida`. |
| `019_Bitacora.sql` | Bitacora de auditoria (RF-09): triggers set-based que registran altas/cambios/bajas de productos, variantes, kardex, cupones y estados de pedido (`TR_Producto_Bitacora`, `TR_Variante_Bitacora`, `TR_Kardex_Bitacora`, `TR_Cupon_Bitacora`, `TR_PedidoHistorialEstado_Bitacora`), la consulta (`SP_Bitacora_Consultar`), los modulos (`SP_Bitacora_Modulos`) y el helper `SP_Bitacora_Registrar`. |
| `099_Semillas.sql` | Datos de ejemplo (usuarios/direccion de M1, catalogo de M2, carga inicial de inventario de M3, carritos de M4 y cupones de M5). Se aplica al final. |

```bash
sqlcmd -S localhost -U sa -P "<password>" -i db/scripts/004_Catalogos.sql
sqlcmd -S localhost -U sa -P "<password>" -i db/scripts/005_SP_Auth.sql
sqlcmd -S localhost -U sa -P "<password>" -i db/scripts/006_SP_Usuarios.sql
sqlcmd -S localhost -U sa -P "<password>" -i db/scripts/007_SP_Direcciones.sql
sqlcmd -S localhost -U sa -P "<password>" -i db/scripts/008_VW_Inventario.sql
sqlcmd -S localhost -U sa -P "<password>" -i db/scripts/009_SP_Categorias.sql
sqlcmd -S localhost -U sa -P "<password>" -i db/scripts/010_SP_Catalogo.sql
sqlcmd -S localhost -U sa -P "<password>" -i db/scripts/011_SP_Inventario.sql
# M5: la migracion y los cupones van ANTES de reaplicar 012, porque
# FU_Carrito_CalcularTotales (en 012) usa las funciones de cupon de 014 y la
# columna Carrito.IDCupon de 013 (una funcion en linea exige que lo referenciado
# exista al crearse). Orden M5: 013 -> 014 -> 012 -> 099.
sqlcmd -S localhost -U sa -P "<password>" -i db/scripts/013_Migracion_CarritoCupon.sql
sqlcmd -S localhost -U sa -P "<password>" -i db/scripts/014_SP_Cupones.sql
sqlcmd -S localhost -U sa -P "<password>" -i db/scripts/012_SP_Carrito.sql
# M6: reaplicar 004 (RESERVA_JOB_SEGUNDOS) y 011 (@SinResultado), luego estados y checkout.
sqlcmd -S localhost -U sa -P "<password>" -i db/scripts/004_Catalogos.sql
sqlcmd -S localhost -U sa -P "<password>" -i db/scripts/011_SP_Inventario.sql
sqlcmd -S localhost -U sa -P "<password>" -i db/scripts/015_Catalogo_EstadosPedido.sql
sqlcmd -S localhost -U sa -P "<password>" -i db/scripts/016_SP_Checkout.sql
sqlcmd -S localhost -U sa -P "<password>" -i db/scripts/017_Migracion_CarritoTokenUnico.sql
# M7 (RF-07): pedidos, ciclo de vida y devoluciones.
sqlcmd -S localhost -U sa -P "<password>" -i db/scripts/018_SP_Pedidos.sql
# M8 (RF-09): bitacora de auditoria (triggers + consulta).
sqlcmd -S localhost -U sa -P "<password>" -i db/scripts/019_Bitacora.sql
sqlcmd -S localhost -U sa -P "<password>" -i db/scripts/099_Semillas.sql
```

## Decisiones tecnicas

**Acceso a datos exclusivo por stored procedures.** El backend nunca arma SQL.
El unico punto de acceso es `executeSp(spName, params)` (`api/src/data/spExecutor.ts`),
que ejecuta `request.execute(spName)` con parametros tipados (`request.input`/
`request.output`). No existe `batch()`, `query()` ni cadenas con comandos SQL en
el codigo TypeScript. `assertIdentifier` valida el nombre del SP y de los
parametros como defensa adicional, aunque siempre provienen del codigo.

**Auditoria de bitacora via session context.** Todo SP que **escribe** datos
recibe `@IDUsuarioEjecuta INT` como un parametro tipado mas (puede ser `NULL`
solo en el registro de clientes, donde aun no hay actor) y, como primera
instruccion, publica ese valor en el contexto de sesion:

```sql
EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;
```

Los triggers de bitacora leen el autor con `SESSION_CONTEXT(N'IDUsuario')`. El
backend **no** fija el contexto de sesion por su cuenta: solo pasa
`@IDUsuarioEjecuta` dentro de `params`, como cualquier otro parametro del SP.

**Bitacora inmutable.** `dbo.Bitacora` es append-only. Ver
[Credenciales de prueba](#credenciales-de-prueba) y `db/scripts/003_Security.sql`:
el usuario de aplicacion solo tiene `EXECUTE` sobre `dbo` (sin permisos de tabla),
y un trigger `INSTEAD OF UPDATE, DELETE` bloquea cualquier modificacion o borrado,
incluso desde `dbo` o un SP.

### Autenticacion y usuarios (M1, RF-01)

- **Hash de contrasenas con `bcryptjs`** (cost 10): implementacion en JS puro, sin
  binarios nativos, para garantizar portabilidad en una maquina limpia (no depende
  de `node-gyp` ni toolchain de compilacion).
- **Refresh token en el cuerpo JSON, no en cookie.** Trade-off deliberado: el
  frontend del reto es una SPA que guarda el token y lo envia explicitamente; evita
  la complejidad de CSRF y de la configuracion de cookies cross-site. El costo es
  que el almacenamiento seguro del refresh queda a cargo del cliente.
- **Rotacion con deteccion de reutilizacion.** Cada refresh se guarda como hash
  SHA-256 (`CHAR(64)`). Al rotar, si llega un token ya revocado se asume robo: se
  revoca **toda la cadena activa** del usuario y se rechaza (401).
- **Lockout de login:** 5 intentos fallidos bloquean la cuenta 15 minutos
  (parametros `LOGIN_MAX_INTENTOS` / `LOGIN_BLOQUEO_MINUTOS`).
- **403 en recursos ajenos verificado en el SP.** La pertenencia de una direccion
  se valida dentro del stored procedure con el `@IDUsuario` del token, no en el
  backend; una direccion de otro usuario responde 403.
- **Usuario desactivado** se rechaza en el login y en el refresh. El access token
  (15 min) no se revoca: simplemente expira solo.
- **Rate limiting** en `/auth/registro`, `/auth/login` y `/auth/refresh`
  (`express-rate-limit`, valores en `.env`); el exceso responde 429 con el mismo
  formato de error del resto de la API.
- **JWT access token** firmado con `JWT_ACCESS_SECRET`, payload
  `{ sub, rol, nombre }`; el middleware `authenticate` adjunta `req.usuario` y
  `authorize(...roles)` restringe por rol.

### Catalogo de productos (M2, RF-02)

- **SKU, precio y existencia pertenecen a la variante.** El producto no tiene
  SKU: agrupa variantes. Un producto sin variantes activas no es vendible ni
  visible en tienda.
- **Baja logica siempre** (`Activo = 0`) para categorias, productos y variantes,
  incluso con ventas asociadas: `PedidoDetalle` y el kardex referencian la
  variante, asi que un borrado fisico romperia el historial. `CambiarEstadoProducto`
  devuelve `TieneVentas` como dato informativo. Las imagenes si se borran
  fisicamente (no las referencia nada).
- **El catalogo nunca escribe `Variante.Existencia`.** La variante nace en 0 y la
  existencia solo cambia por kardex (M3). Ningun SP de M2 toca esa columna.
- **Visible en tienda** = `Producto.Activo = 1` AND `Categoria.Activo = 1` AND al
  menos una variante activa. Desactivar un producto no cambia el `Activo` de sus
  variantes.
- **Disponibilidad** via `VW_Inventario_Disponible`: `Disponible = Existencia -`
  reservas activas no vencidas.
- **Busqueda sin SQL dinamico.** Filtros opcionales con el patron
  `(@Param IS NULL OR columna = @Param)`, `LIKE` con `CONCAT(N'%', @Texto, N'%')`,
  orden por lista blanca con expresiones `CASE` (nunca columna interpolada) y
  `OPTION (RECOMPILE)` para que el plan se ajuste a los filtros efectivos.
- **TVP para atributos.** Los atributos de variante se envian como un parametro de
  tipo tabla `dbo.TVP_VarianteAtributo` (objeto `sql.Table` de mssql) en una sola
  llamada; cero SQL en TypeScript.
- **Imagenes solo por URL** (no se suben binarios). Una imagen principal por
  producto, garantizada dentro del SP en una transaccion.
- **Lectura del catalogo:** publica sin token (`/catalogo/...`, siempre
  `IncluirInactivos = 0`), o de administracion para Administrador y Operador
  (acepta `incluirInactivos`). La **escritura** es exclusiva del Administrador.
- **404 uniforme** para un producto inexistente o inactivo en la ruta publica: la
  misma respuesta en ambos casos, para no revelar el catalogo oculto.

### Inventario y kardex (M3, RF-03)

- **Un unico SP escribe la existencia.** `SP_Inventario_RegistrarMovimiento` es el
  unico lugar que hace `UPDATE` sobre `Variante.Existencia`; ningun otro SP de ningun
  modulo la toca. Checkout, cancelacion y devolucion (modulos futuros) llamaran a este
  SP desde sus propios SPs, nunca con un update directo.
- **Invariante `Existencia = SUM(Signo * Cantidad)` del kardex.** Cada fila de `Kardex`
  guarda `ExistenciaResultante`. `SP_Inventario_VerificarConsistencia` audita el
  invariante y el endpoint `GET /inventario/consistencia` (Administrador) debe devolver
  cero inconsistencias.
- **Tipos reservados al sistema.** La API solo expone `ENTRADA_COMPRA`,
  `AJUSTE_POSITIVO` y `AJUSTE_NEGATIVO`. `SALIDA_VENTA`, `DEVOLUCION` y `CANCELACION`
  exigen `@OrigenInterno = 1`, que solo envian los SPs de pedidos; el backend nunca
  expone ni envia ese parametro (intentarlo desde la API responde 403).
- **Ajuste negativo mas estricto que el fisico.** Un movimiento negativo no puede dejar
  la existencia fisica < 0 **ni** el disponible (`existencia - reservas activas no
  vencidas`) < 0. Es mas estricto que exigir solo existencia >= 0: evita vender o retirar
  unidades ya comprometidas por reservas de carritos vigentes, que romperian un checkout
  en curso.
- **Concurrencia.** El movimiento lee la variante con `WITH (UPDLOCK, HOLDLOCK)` dentro
  de la transaccion (aislamiento READ COMMITTED por defecto), serializando los
  movimientos concurrentes sobre la misma variante y evitando condiciones de carrera al
  recalcular la existencia.
- **Kardex inmutable de hecho:** solo hay `INSERT` sobre `Kardex`; ningun SP hace
  `UPDATE`/`DELETE` de movimientos. La correccion de un error se hace con un ajuste
  compensatorio, no editando el historial.
- **`STOCK_MINIMO`** vive en `dbo.Parametro` (= 5); el listado de existencias marca
  `BajoStock` cuando `Disponible <= STOCK_MINIMO` y acepta `soloBajoStock=true`.
- **Semillas via el SP.** La carga inicial de inventario (`099`) recorre las variantes
  activas sin kardex y llama a `SP_Inventario_RegistrarMovimiento` (ENTRADA_COMPRA);
  nunca hace `UPDATE` directo, de modo que la existencia sembrada tambien respeta el
  invariante.

### Carrito de compras (M4, RF-04)

- **El carrito no lleva ID en la URL.** Se identifica SIEMPRE por la identidad: el
  cliente autenticado usa su carrito `Activo` (se crea si no existe); el invitado usa
  el header `X-Cart-Token` (UUID). El middleware `cartIdentity` resuelve `req.carrito`
  y nunca se acepta un ID de carrito del cliente. Rutas: `GET /carrito`,
  `POST /carrito/items`, `PUT/DELETE /carrito/items/:idVariante`, `DELETE /carrito`.
- **Invitado por token UUID.** Si un invitado no envia header, el primer
  `POST /carrito/items` crea el carrito y la API devuelve el token en el header
  `X-Cart-Token` y en el cuerpo (`cartToken`). `GET /carrito` sin identidad ni header
  responde 200 con un carrito vacio sin crear nada.
- **Solo el servidor acuna tokens.** Un cliente no puede inventar un `X-Cart-Token`
  para materializar un carrito: el carrito de invitado se crea unicamente cuando el
  backend genera el UUID (`randomUUID`) en el primer `POST /carrito/items` sin header.
  `SP_Carrito_AgregarItem` recibe `@CrearSiNoExiste` y el servicio lo envia en 1 solo
  en ese caso; con un token desconocido las escrituras (`POST`/`PUT`/`DELETE` de item y
  `DELETE /carrito`) responden **404 `Carrito no encontrado`**. `GET /carrito` con un
  token desconocido sigue respondiendo 200 con el carrito vacio (sin error), para no
  filtrar la existencia de carritos.
- **Operador y Administrador no tienen carrito.** Cualquier ruta de `/carrito`
  responde 403 para esos roles; el carrito es exclusivo del rol Cliente. Si llegan
  Bearer de Cliente y `X-Cart-Token` a la vez, se ignora el header (manda la identidad).
- **Fusion en login/registro.** `POST /auth/login` y `POST /auth/registro` aceptan el
  header opcional `X-Cart-Token`; tras autenticar, el servicio llama a
  `SP_Carrito_Fusionar`. Si el token no existe o su carrito no esta `Activo`, no es
  error (se ignora). Las lineas del invitado se suman al carrito del usuario (creandolo
  si no existe) **topando cada cantidad al disponible**; el carrito invitado queda
  `Convertido`. La respuesta incluye `carritoFusionado: { lineas, advertencias }` o
  `null`.
- **Validacion suave de disponible; la reserva es del checkout.** El carrito nunca
  reserva existencia ni toca `Variante.Existencia`, `Kardex` ni `Reserva`: solo valida
  que la cantidad de la linea sea `<= Disponible` (`Existencia - reservas activas no
  vencidas`) en el momento de agregar/modificar. La reserva real ocurre en el checkout
  (M6). Por eso `GET /carrito` marca cada linea con `Advertencia` (sin existencia o no
  disponible) en vez de rechazarla: el disponible pudo cambiar despues de agregarla.
- **Regla de bloqueo heredada de M3.** Todo SP que lee el disponible para decidir una
  escritura bloquea primero la fila de `dbo.Variante` con `WITH (UPDLOCK, HOLDLOCK)`
  dentro de la transaccion y despues consulta `Reserva`. La fusion bloquea las variantes
  en orden de `IDVariante` para evitar deadlocks.
- **Totales y desglose de IVA en SQL con `DECIMAL(18,2)`.** `FU_Carrito_CalcularTotales`
  (funcion en linea, invocada solo desde SPs) calcula `TotalLinea = ROUND(Precio *
  Cantidad, 2)`, `Subtotal`, `Total = Subtotal - Descuento`, y el IVA incluido en el
  precio: `BaseImponible = ROUND(Total / (1 + IVA/100), 2)`, `IVA = Total -
  BaseImponible`. El `PorcentajeIVA` sale del parametro `IVA_PORCENTAJE` (default 12).
  El backend nunca calcula montos.
- **Descuento = 0 en M4.** `Descuento` siempre es `0.00`; la funcion lo deja marcado
  para que **M5 (cupones)** lo sustituya. El cupon del carrito se resuelve en M5 con un
  script de migracion (no se agregaron columnas en M4).
- **Precio vigente en el carrito, congelado en el pedido.** Las lineas usan
  `Variante.Precio` actual; el precio se congela recien al crear el pedido (M6).
- **Limites.** Cantidad por linea entre 1 y 1000; maximo 50 lineas por carrito (la
  linea 51 responde 422). `PUT` fija la cantidad (no suma); `POST` suma a la existente.
- **Abandono como estado derivado (M9).** Cada escritura actualiza
  `FechaUltimaActividad`; el estado `Abandonado` lo derivara un proceso de M9. En las
  semillas el carrito de invitado nace con la fecha retrasada 3 dias (unico lugar donde
  se toca esa fecha a mano, y solo para datos de prueba).

### Cupones y promociones (M5, RF-05)

- **Migracion 013, no cambios en el 001.** El modelo base no se toca. `Carrito.IDCupon`
  (nullable, con FK a `Cupon`) se agrega en `013_Migracion_CarritoCupon.sql` para que el
  carrito recuerde el cupon aplicado **antes** del checkout. La migracion es idempotente
  (`COL_LENGTH` / `sys.foreign_keys`) y usa `GO` para que la columna exista antes de
  referenciarla. Orden de aplicacion de M5: **013 -> 014 -> 012 (se reaplica) -> 099**,
  porque `FU_Carrito_CalcularTotales` (012) depende de las funciones de cupon (014) y de
  la columna (013): una funcion en linea exige que lo referenciado exista al crearse.
- **Aplicar no es consumir.** M5 solo **valida y guarda** `Carrito.IDCupon`; nunca toca
  `Cupon.UsosActuales` ni inserta en `CuponUso`. El **consumo** de un uso es del checkout
  (M6): dentro de su transaccion, con `UPDATE Cupon SET UsosActuales = UsosActuales + 1
  WHERE ... AND (LimiteUsosTotal IS NULL OR UsosActuales < LimiteUsosTotal)` validando
  `@@ROWCOUNT`, con el `CHECK` de tabla como ultima defensa. Orden de bloqueo del
  checkout: `Carrito` -> `Variante` -> `Reserva` -> `Cupon`.
- **Cupones solo con sesion.** Son exclusivos del Cliente autenticado. En
  `POST`/`DELETE /carrito/cupon` el controlador exige `req.carrito.idUsuario`; un invitado
  recibe **401 `Inicie sesion para aplicar cupones`** antes de tocar la base.
- **Base elegible y formulas.** La base elegible es el subtotal de las lineas cuya
  `Producto.IDCategoria` coincide con `Cupon.IDCategoria` (si el cupon tiene categoria) o
  el subtotal completo. `PORCENTAJE -> ROUND(base * Valor / 100, 2)`; `MONTO -> el menor
  entre Valor y base`. El descuento nunca supera el `Subtotal`. Todo en `DECIMAL(18,2)` y
  calculado en SQL (`FU_Cupones_CalculoDescuento`); el backend no calcula montos.
- **Monto minimo contra el subtotal.** El `MontoMinimo` se compara contra el `Subtotal`
  completo del carrito (no contra la base elegible).
- **Validez en orden con mensaje propio.** `FU_Cupones_Estado` evalua y devuelve la
  primera causa que falla: (1) no existe o inactivo -> **404 `Cupon invalido`**; (2) aun
  no vigente, (3) vencido, (4) agotado, (5) limite por cliente alcanzado, (6) no alcanza
  el monto minimo (`... de Q X (faltan Q Y)`), (7) con categoria y base elegible 0 -> todas
  **422**. El codigo se normaliza con `UPPER(TRIM(...))`.
- **Re-validacion al mostrar.** `GET /carrito` recalcula el cupon guardado: si ya no
  cumple 1-7, `Descuento = 0` y el objeto `cupon.descuento` informa `valido: false` y la
  `causa`; **no** lanza error. `FU_Carrito_CalcularTotales` solo descuenta cuando el cupon
  sigue siendo valido.
- **Un cupon por carrito.** Aplicar uno reemplaza el anterior (`UPDATE Carrito SET
  IDCupon`). `DELETE /carrito/cupon` lo quita (sin error si no habia). Vaciar el carrito
  (`DELETE /carrito`) tambien quita el cupon: `SP_Carrito_Vaciar` pone `IDCupon = NULL`
  porque un carrito vacio no conserva cupon.
- **Cupon con usos congelado.** Un cupon con usos (`CuponUso` o `UsosActuales > 0`) no
  puede cambiar `Codigo`, `TipoDescuento`, `Valor` ni `IDCategoria` (**409**); si solo
  cambian fechas o limites, se permite. `SP_Cupones_Actualizar` nunca escribe
  `UsosActuales`.
- **Respuesta del carrito.** El servicio arma `cupon` desde el tercer recordset de
  `SP_Carrito_Obtener` como `{ IDCupon, Codigo, TipoDescuento, Valor, Categoria, descuento:
  { baseElegible, descuento, valido, causa } }` (o `null`). El `Descuento` del cupon ya
  esta reflejado en `carrito.totales`.

### Checkout y pago (M6, RF-06)

- **Dos pasos: reservar y luego pagar.** `POST /checkout/iniciar` **reserva** existencia
  por `RESERVA_MINUTOS` (parametro, default 15) y devuelve un resumen con totales y costo
  de envio; `POST /checkout/pagar` **cobra** (pago simulado) y, si aprueba, crea el pedido.
  Separar reserva de pago evita vender mas unidades de las que hay cuando varios clientes
  compiten por el ultimo stock.
- **Iniciar es reiniciable.** Vuelve a reservar: libera las reservas `Activa` del propio
  carrito y crea nuevas. Reintentar el checkout nunca acumula reservas duplicadas.
- **Pagar exige reserva vigente.** `SP_Pedidos_CrearPedido` verifica que **todas** las
  lineas tengan `Reserva` `Activa`, `FechaExpira > ahora` y la misma cantidad; si no,
  **409 `La reserva vencio o no existe; inicie el checkout de nuevo`**. Asi la reserva es
  el "boleto" que garantiza el stock entre los dos pasos.
- **Idempotencia en la base.** El header `Idempotency-Key` (16-100, `[A-Za-z0-9_-]`) se
  guarda como `Pago.ClaveIdempotencia` con `UNIQUE`. El SP bloquea el carrito
  (`UPDLOCK, HOLDLOCK`) y busca el pago por clave **dentro** del lock: si ya existe y es del
  mismo usuario, hace **replay** y devuelve exactamente el mismo resultado (sin tocar nada);
  si es de otro usuario, **409 `Clave de idempotencia en uso`**. El `UNIQUE` es la ultima
  defensa ante una carrera. Dos `pagar` con la misma clave devuelven el mismo
  `NumeroPedido` y el mismo codigo HTTP; uno trae `replay: true`.
- **Pago simulado y 402.** `simularResultado` (`APROBADO` por defecto) decide el desenlace.
  Aprobado responde **201** (se creo el pedido); rechazado responde **402 Payment
  Required** (semantica HTTP del pago que no prospera), registra el `Pago` `Rechazado`,
  **no** crea pedido y **deja las reservas intactas** para poder reintentar. En replay se
  repite el mismo codigo (201 o 402), deducido de `aprobado`.
- **Orden exacto de la transaccion aprobada.** (0) **pre-bloquear** las variantes del
  carrito en `IDVariante` ascendente (recorriendo `CarritoDetalle`, antes de leer totales y
  de construir `#Lineas`), (1) leer totales y armar el snapshot (`#Lineas` con prorrateo),
  (2) consumir reservas (`Estado = 'Consumida'`, solo vigentes; si el numero de reservas
  consumidas no iguala las lineas del carrito -> `409`), (3) crear `Pedido`, (4)
  `PedidoDetalle`, (5) un `SP_Inventario_RegistrarMovimiento` `SALIDA_VENTA` por linea, (6)
  uso del cupon, (7) `Pago` aprobado, (8) `Carrito` `Convertido`, (9) historial de estado.
  **Las reservas se consumen ANTES del kardex** porque `SP_Inventario_RegistrarMovimiento`
  descuenta del disponible las reservas activas; si siguieran `Activa`, la salida de venta
  de la misma cantidad se bloquearia a si misma.
- **Orden de bloqueo anti-deadlock.** `Carrito (UPDLOCK, HOLDLOCK)` -> `Variante
  (UPDLOCK, HOLDLOCK, IDVariante ascendente)` -> `Reserva` -> `Cupon (UPDLOCK)`. En la rama
  aprobada se **pre-bloquean** primero todas las variantes del carrito en `IDVariante`
  ascendente (un `SELECT ... WITH (UPDLOCK, HOLDLOCK)` por cada una) y solo despues se
  consumen las reservas y se registra el kardex. El pre-bloqueo es necesario: sin el, entre
  consumir la reserva (que la quita del disponible) y registrar la salida de venta, otro
  carrito podria reservar esa unidad y el pago fallaria. Con el, el orden se cumple de forma
  literal y las variantes quedan retenidas hasta el `COMMIT`.
- **SPs anidados.** `SP_Inventario_RegistrarMovimiento` abre su propio `BEGIN TRAN/COMMIT`
  dentro de la transaccion de `CrearPedido` (el commit interno solo decrementa
  `@@TRANCOUNT`). Un `THROW` interno ya hizo `ROLLBACK` de todo y relanza; el `CATCH`
  exterior encuentra `@@TRANCOUNT = 0` y solo relanza. Se le pasa `@SinResultado = 1` para
  que **no** devuelva un result set por cada movimiento y asi no contaminar la salida.
- **Snapshot y prorrateo del descuento.** El pedido guarda un snapshot inmutable: `SKU`,
  `NombreProducto`, `DescripcionVariante` (`STRING_AGG` de los atributos), `IDCategoria`,
  `PrecioUnitario` y el `DescuentoLinea` **prorrateado**. Por linea elegible,
  `DescuentoLinea = ROUND(Descuento * TotalLineaBruta / BaseElegible, 2)`; la ultima linea
  elegible (mayor `IDVariante`) absorbe el redondeo para que `SUM(DescuentoLinea) =
  Descuento` al centavo; las no elegibles van en 0. `TotalLinea = bruto - DescuentoLinea`.
- **Numero de pedido legible.** `NumeroPedido = 'SC-' + FORMAT(NEXT VALUE FOR
  SEQ_Pedido_Numero, '000000')` (p.ej. `SC-000001`), con `UNIQUE`.
- **IVA sobre el total con envio.** El costo de envio **grava IVA**: la base imponible y el
  IVA se calculan sobre el total **con** envio, no sobre el del carrito. La formula es
  `BaseImponible = ROUND(Total / (1 + IVA/100), 2)` e `IVA = Total - BaseImponible`, con
  `Total = Subtotal - Descuento + CostoEnvio`. `FU_Carrito_CalcularTotales` (012) **no**
  cambia (es del carrito, sin envio); por eso `SP_Checkout_Iniciar` y `SP_Checkout_Resumen`
  recalculan `BaseImponible`/`IVA` sobre `TotalConEnvio` con esa misma formula (no usan los
  de la funcion). `SP_Pedidos_CrearPedido` ya persiste el pedido con esta regla.
- **Estados y ciclo de vida.** `015` siembra `EstadoPedido` y `TransicionEstadoPedido`.
  El pedido nace en `PAGADO` y avanza por transiciones permitidas (las aplicara M7):

  ```mermaid
  stateDiagram-v2
      [*] --> PAGADO: pago aprobado
      PAGADO --> EN_PREPARACION: Operador
      EN_PREPARACION --> DESPACHADO: Operador
      DESPACHADO --> ENTREGADO: Operador
      PAGADO --> CANCELADO: Cliente u Operador
      EN_PREPARACION --> CANCELADO: Cliente u Operador
      ENTREGADO --> DEVUELTO: Operador
      CANCELADO --> [*]
      DEVUELTO --> [*]
  ```

- **Liberacion de reservas por job + consulta.** `SP_Checkout_LiberarReservasVencidas`
  marca `Liberada` toda reserva `Activa` vencida (sin `session context`: actor nulo). El
  job `jobs/liberarReservas.ts` lo llama cada `RESERVA_JOB_SEGUNDOS` (default 60), loguea
  solo si libero algo y nunca tumba el proceso (errores capturados); arranca tras escuchar
  y se detiene en el apagado. Una bandera `enEjecucion` evita el solapamiento: si una
  corrida sigue viva (base lenta), la siguiente se salta ese ciclo y lo registra. El Administrador puede dispararlo a mano con
  `POST /checkout/reservas/liberar`. El disponible se lee en vivo de
  `VW_Inventario_Disponible` (existencia - reservas activas no vencidas).
- **Prueba de concurrencia.** `api/tests/concurrencia.mjs` (Node 24 puro, solo HTTP) crea
  una variante con **1 unidad**, registra 10 clientes que compiten y verifica: 10
  `iniciar` en paralelo -> **1x201 / 9x409**; dos `pagar` del ganador con la misma clave ->
  ambos **201**, mismo `NumeroPedido`, uno con `replay`; `GET /inventario/consistencia` ->
  `consistente: true`; un perdedor reintenta -> **409**; un pago **RECHAZADO** -> **402** con
  monto numerico y reintento **APROBADO** -> **201**; cliente B reutiliza la clave de A ->
  **409** sin `pedido`; y tras el pedido la variante en contienda queda en `Existencia=0`,
  `Reservado=0`. Se corre con la API arriba:
  `BASE_URL=http://localhost:3000 npm run test:concurrencia` (sale con codigo 1 si algun
  escenario falla). Registra 10 clientes + login admin, asi que conviene correr la API con
  `RATE_LIMIT_AUTH_MAX` alto (p.ej. 100); con el default (10) el limitador devuelve 429. El
  escenario de rechazo requiere `PAGO_SIMULADO=true`; cada usuario hace <=3 operaciones de
  checkout (por debajo de `RATE_LIMIT_CHECKOUT_MAX=20`), pero si se baja ese limite, correr
  con `RATE_LIMIT_CHECKOUT_MAX=100`.
- **Pago simulado gobernado por entorno.** `PAGO_SIMULADO` (default `false`) decide si el
  cliente puede elegir el desenlace. Con `false`, el backend **ignora** `simularResultado`
  del body y cobra siempre `APROBADO` (el body lo sigue aceptando para no romper Postman).
  Si `NODE_ENV=production` y `PAGO_SIMULADO=true`, la app **no arranca**. El resultado del
  pago siempre lo decide el servidor, nunca el cliente: al integrar una pasarela real, el SP
  recibira el resultado ya verificado por la pasarela.
- **Rate limiting del checkout.** `/checkout/iniciar` y `/checkout/pagar` se limitan por
  **usuario autenticado** (no por IP, para no castigar a varios clientes tras un mismo NAT),
  ventana de 1 minuto, maximo `RATE_LIMIT_CHECKOUT_MAX` (default 20). El exceso responde
  **429** con el formato de error estandar `{ code: 'RATE_LIMITED', message, requestId }`.

### Decisiones abiertas (M6)

- **Reinicio libre de `checkout/iniciar`.** Reiniciar el checkout vuelve a reservar sin
  limite de intentos. Se mitiga con **un solo carrito activo por usuario** (indice unico
  filtrado) y el **rate limit** del checkout. En produccion se anadiria un backoff por
  usuario y metricas de reservas creadas/liberadas para detectar abuso.
- **Clave de idempotencia unica global.** `Pago.ClaveIdempotencia` es `UNIQUE` en toda la
  tabla, no por usuario; por eso la clave de un usuario reusada por otro da **409** (y no un
  replay ajeno). Es lo mas seguro ante colisiones, a costa de que dos usuarios no puedan
  elegir la misma cadena. En produccion la clave la genera el cliente como UUID, asi que la
  colision entre usuarios es despreciable; si se quisiera aislar por usuario, la unicidad
  pasaria a `(IDUsuario, ClaveIdempotencia)`.
- **El replay no compara el cuerpo.** Un segundo `pagar` con la misma clave devuelve el
  resultado original **sin** verificar que el body coincida con el primero. Se asume que el
  cliente reintenta la MISMA peticion (semantica habitual de idempotencia). En produccion se
  guardaria un hash del cuerpo con la clave y se devolveria **422** si el reintento llega con
  un cuerpo distinto.
- **Correccion de modelo: unicidad del token de invitado.** En SQL Server un `UNIQUE`
  admite un solo NULL, asi que el `UQ_Carrito_TokenInvitado UNIQUE (TokenInvitado)` original
  dejaba crear un unico carrito de usuario (token NULL) y el segundo fallaba con error 2627.
  Corregido en la migracion `017` reemplazandolo por el indice unico filtrado
  `UX_Carrito_TokenInvitado ... WHERE TokenInvitado IS NOT NULL`: la unicidad aplica solo a
  tokens reales y los NULL quedan sin restringir (misma tecnica que `UX_Carrito_UsuarioActivo`).

### Pedidos y devoluciones (M7, RF-07)

Ciclo de vida del pedido gobernado por el grafo de `dbo.TransicionEstadoPedido` (`015`).
El pedido nace en `PAGADO` (lo crea el checkout de M6) y solo avanza por transiciones
permitidas:

```mermaid
stateDiagram-v2
    [*] --> PAGADO: pago aprobado (M6)
    PAGADO --> EN_PREPARACION: Operador / Admin
    EN_PREPARACION --> DESPACHADO: Operador / Admin
    DESPACHADO --> ENTREGADO: Operador / Admin
    PAGADO --> CANCELADO: Cliente dueno / Operador / Admin
    EN_PREPARACION --> CANCELADO: Cliente dueno / Operador / Admin
    ENTREGADO --> DEVUELTO: solo via devolucion (Operador / Admin)
    CANCELADO --> [*]
    DEVUELTO --> [*]
```

**Quien puede cada transicion** (lo valida `SP_Pedidos_CambiarEstado` con el rol que le
pasa la API; el `Administrador` hereda lo del `Operador`):

| Transicion | Cliente (dueno) | Operador | Administrador |
|------------|:---------------:|:--------:|:-------------:|
| PAGADO -> EN_PREPARACION | no | si | si |
| EN_PREPARACION -> DESPACHADO | no | si | si |
| DESPACHADO -> ENTREGADO | no | si | si |
| PAGADO -> CANCELADO | si | si | si |
| EN_PREPARACION -> CANCELADO | si | si | si |
| ENTREGADO -> DEVUELTO | — (solo via devolucion) | si | si |

- **Cancelacion.** Solo desde `PAGADO` o `EN_PREPARACION`. Por cada linea se registra un
  movimiento `CANCELACION` (+Cantidad) via `SP_Inventario_RegistrarMovimiento`
  (`@OrigenInterno = 1`), en `IDVariante` ascendente con las variantes pre-bloqueadas
  (`UPDLOCK, HOLDLOCK`) antes del bucle, de modo que la existencia se repone. El cliente
  solo puede cancelar SU pedido (ownership validado en el SP; `404` uniforme si es ajeno).
- **Devolucion.** Solo desde `ENTREGADO`, por `Operador`/`Administrador`. Las lineas llegan
  en el TVP `dbo.TVP_DevolucionLinea`. Se valida pertenencia al pedido, cantidad > 0, sin
  lineas repetidas y `Cantidad + CantidadDevuelta <= Cantidad` vendida (`422` con el SKU en
  el mensaje). Se inserta `Devolucion` (`MontoReintegrado = Σ MontoLinea`, con
  `MontoLinea = ROUND(TotalLinea * Cantidad / CantidadVendida, 2)`), se acumula
  `PedidoDetalle.CantidadDevuelta` y se repone inventario con movimientos `DEVOLUCION`
  (+Cantidad), mismo patron de pre-bloqueo ascendente. Todo en una sola transaccion.
- **Respaldo en BD.** El trigger `TR_Pedido_TransicionValida` rechaza (`50409`) cualquier
  `UPDATE` directo de `Pedido` que cambie el estado a un par no presente en el grafo; no
  afecta a la creacion ni a updates que no cambian el estado.

Tres decisiones de M7:

- **Cancelar devuelve el uso del cupon.** Si el pedido tenia cupon, al cancelar se hace
  `UsosActuales - 1` (nunca por debajo de 0) y se borra su fila de `CuponUso`, para que el
  cliente pueda volver a usarlo. El reembolso del pago es simulado: solo se documenta, no
  hay tabla de reembolsos.
- **Las devoluciones las registra Operador/Administrador**, nunca el cliente: evita que el
  comprador se auto-acredite reintegros. El cliente consulta el estado resultante.
- **`DEVUELTO` solo cuando TODAS las lineas estan devueltas por completo.** Una devolucion
  parcial deja el pedido en `ENTREGADO` (con la `CantidadDevuelta` acumulada); solo cuando
  ninguna linea tiene unidades pendientes el pedido transiciona `ENTREGADO -> DEVUELTO`.

### Bitacora de auditoria (M8, RF-09)

Toda creacion, modificacion o desactivacion en productos, precios, existencias, cupones y
estados de pedido queda registrada en `dbo.Bitacora` con usuario, fecha, entidad, accion
(`CREAR` / `MODIFICAR` / `DESACTIVAR`), valor anterior y valor nuevo. La auditoria **no**
vive en el backend: la producen **triggers** `AFTER` set-based (sin cursores) definidos en
`019_Bitacora.sql`, de modo que cualquier escritura queda registrada aunque no pase por un
SP concreto.

| Trigger | Tabla | Modulo | Que registra |
|---------|-------|--------|--------------|
| `TR_Producto_Bitacora` | `Producto` | `CATALOGO` | `INSERT` -> `CREAR`; `UPDATE` -> `MODIFICAR`, salvo `Activo 1->0` -> `DESACTIVAR`. |
| `TR_Variante_Bitacora` | `Variante` | `CATALOGO` | Igual; el JSON incluye el precio (anterior y nuevo). |
| `TR_Kardex_Bitacora` | `Kardex` | `INVENTARIO` | `INSERT` -> `CREAR`; `ValorNuevo` = JSON del movimiento. |
| `TR_Cupon_Bitacora` | `Cupon` | `CUPONES` | `CREAR` / `MODIFICAR` / `DESACTIVAR`. |
| `TR_PedidoHistorialEstado_Bitacora` | `PedidoHistorialEstado` | `PEDIDOS` | `CREAR` (sin estado anterior) o `MODIFICAR`; `IDEntidad = IDPedido`. |

- **Como llega el usuario (SESSION_CONTEXT).** Todo SP que escribe fija, como primera
  instruccion, `sp_set_session_context @key = N'IDUsuario'` con el `@IDUsuarioEjecuta`. Los
  triggers lo leen con `TRY_CAST(SESSION_CONTEXT(N'IDUsuario') AS INT)` (queda `NULL` si no
  hay actor, p. ej. el job de reservas, que ademas no escribe tablas auditadas).
- **La existencia se audita por Kardex, no por Variante.** `Variante.Existencia` solo la
  mueve `SP_Inventario_RegistrarMovimiento`, que ademas deja la fila de `Kardex` con su
  motivo y existencia resultante. Por eso `TR_Variante_Bitacora` **omite** los cambios que
  solo tocan `Existencia`: duplicarlos en `CATALOGO` seria ruido; la trazabilidad del stock
  esta completa en `INVENTARIO`. Por la misma razon `TR_Cupon_Bitacora` omite el cambio que
  solo mueve `UsosActuales` (consumo del checkout o devolucion del uso al cancelar): no es
  un cambio de gestion del cupon.
- **JSON de valores.** `ValorAnterior`/`ValorNuevo` son JSON compacto
  (`FOR JSON PATH, WITHOUT_ARRAY_WRAPPER`) con las columnas de negocio relevantes (excluye
  `Fecha*` y hashes). La excepcion es `PEDIDOS`, donde se guarda el **codigo** del estado
  anterior y del nuevo (p. ej. `PAGADO` -> `EN_PREPARACION`).
- **Inmutabilidad en 3 capas.** (1) `DENY UPDATE, DELETE` a `shopcart_app` (`003`); (2) el
  trigger `TR_Bitacora_Inmutable` `INSTEAD OF UPDATE, DELETE` lanza `50403` para cualquier
  principal, incluso `dbo`; (3) ningun SP hace `UPDATE`/`DELETE` sobre `dbo.Bitacora`. Los
  triggers de auditoria solo hacen `INSERT`.
- **Consulta (solo Administrador).** `GET /api/v1/bitacora` (`SP_Bitacora_Consultar`) con
  filtros opcionales (`modulo`, `entidad`, `idEntidad`, `idUsuario`, `accion`, `desde`,
  `hasta`) y paginacion (`pagina`, `tamano`); devuelve las filas (con el correo/nombre del
  usuario) y el total, ordenadas por fecha descendente. `GET /api/v1/bitacora/modulos`
  (`SP_Bitacora_Modulos`) lista los modulos presentes para alimentar el filtro.

## Logs

La API usa [pino](https://getpino.io) (`api/src/config/logger.ts`). El `logger` emite JSON
en todos los entornos; solo con `NODE_ENV=development` la salida es legible
(`pino-pretty`). El nivel lo fija `LOG_LEVEL` (default `info`).

- **Una linea por request.** `pino-http` registra metodo, url (sin query string), status,
  duracion (ms) y `requestId` (el mismo que acuna `requestContext` y viaja en
  `X-Request-Id`). Se omite `/health`.
- **Nunca se registran** los headers `Authorization`, `X-Cart-Token` ni `Idempotency-Key`,
  ni los cuerpos ni la query (los serializadores solo exponen metodo, ruta y status; esos
  headers ademas estan en la lista de `redact`).
- **Errores.** El `errorHandler` registra los `5xx` como `error` (con stack) y los `4xx`
  como `warn` (sin stack), ambos con el `code` y el `requestId`.

## Pruebas con Postman

La coleccion `docs/postman/ShopCart.postman_collection.json` cubre M1, M2, M3, M4, M5, M6, M7 y M8.

> Para correr la **coleccion completa** de una sola pasada con el Collection Runner conviene
> arrancar la API con `RATE_LIMIT_AUTH_MAX=100` y `RATE_LIMIT_CHECKOUT_MAX=100`: con los
> valores por defecto (10 y 20) los multiples logins y checkouts de las carpetas acumuladas
> hacen saltar el limitador (`429`).

1. Importela en Postman (boton **Import**). No requiere un entorno aparte: las
   variables viven en la coleccion (`baseUrl`, tokens por rol e IDs que los
   requests capturan solos). Ajuste `baseUrl` si la API no corre en
   `http://localhost:3000`.
2. Carpetas, en orden sugerido: **Auth** -> **Usuarios (Administrador)** ->
   **Direcciones (Cliente)** -> **Casos negativos** -> **M2 Catalogo** ->
   **M3 Inventario** -> **M4 Carrito** -> **M5 Cupones** -> **M6 Checkout** ->
   **M7 Pedidos** -> **M8 Bitacora**.
3. Cada carpeta inicia sesion y guarda los tokens/IDs que necesita, de modo que
   puede ejecutarse con el **Collection Runner** de principio a fin tras aplicar
   los scripts `001`-`018` y `099` en SQL Server (en el orden del bloque anterior:
   `013`/`014` antes de reaplicar `012`, y `004`/`015`/`016`/`017` para M6, `018` para M7).
   La carpeta **M4 Carrito** toma el `idVariante` y el disponible del catalogo publico (sin
   IDs fijos) y es repetible. La carpeta **M5 Cupones** prepara el carrito del cliente con
   una variante de Lubricantes y deja `LUB50` aplicado al terminar. La carpeta
   **M6 Checkout** prepara su propio carrito, inicia el checkout, prueba el pago sin
   `Idempotency-Key` (400), un pago rechazado (402), uno aprobado (201) y su replay
   (201, `replay: true`), y genera las claves de idempotencia con `{{$guid}}`. La carpeta
   **M7 Pedidos** es repetible (sufijo por corrida): crea una variante con stock, un pedido
   via M6 y recorre todo el ciclo de vida, la cancelacion y las devoluciones (parcial y
   total), verificando que el inventario se reponga. La carpeta **M8 Bitacora** es repetible
   (sufijo por corrida): el admin crea producto/variante, cambia el precio y desactiva el
   producto; crea y desactiva un cupon; el operador registra una entrada de inventario; se
   corre un pedido completo via checkout y el operador lo avanza a `EN_PREPARACION`. Luego
   consulta `GET /bitacora` por modulo (`CATALOGO`, `INVENTARIO`, `CUPONES`, `PEDIDOS`),
   verifica las acciones, el usuario (por correo) y el JSON de valores, que un modulo
   inexistente responde `200` con 0 filas, que `GET /bitacora/modulos` incluye los cuatro
   modulos, y que el cliente y el operador reciben `403` al consultar la bitacora.

> El rate limit de `/auth/*` es por IP y compartido. Para ver un `429` limpio en
> "Login x11" conviene reiniciar la API o esperar la ventana configurada.

## Diagrama ER

Pendiente.

## Credenciales de prueba

El script `db/scripts/003_Security.sql` crea el login/usuario de aplicacion
`shopcart_app` con la contrasena de **desarrollo** `ShopCart_Dev_2026!` (la misma
que trae `api/.env.example`). Este principal solo tiene `GRANT EXECUTE ON
SCHEMA::dbo`: ejecuta los stored procedures, pero no puede leer ni escribir
tablas directamente.

> **Es una credencial de desarrollo.** Debe cambiarse por un secreto fuerte y
> rotarse fuera del control de versiones en cualquier ambiente real.

### Usuarios de ejemplo (M1)

`db/scripts/099_Semillas.sql` crea tres usuarios de **desarrollo** (hash bcryptjs,
cost 10). El cliente incluye una direccion activa.

| Correo | Contrasena | Rol |
|--------|-----------|-----|
| `admin@shopcart.local` | `Admin123!` | Administrador |
| `operador@shopcart.local` | `Operador123!` | Operador |
| `cliente@shopcart.local` | `Cliente123!` | Cliente |

> Contrasenas de desarrollo conocidas: no usar en ambientes reales.

## Ciclo de vida del pedido

Pendiente.
