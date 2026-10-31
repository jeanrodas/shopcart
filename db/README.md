# Base de datos — ShopCart

Scripts SQL para SQL Server 2019+. Se aplican sobre una **instancia limpia**.

## Numeracion y orden de ejecucion

Los scripts se ejecutan **en orden ascendente por su prefijo numerico**. Cada
script es idempotente o pensado para una instancia nueva, segun su rol:

| Script | Descripcion |
|--------|-------------|
| `001_CreateDatabase.sql` | Crea la base de datos `ShopCart` y todo el modelo relacional (tablas, constraints, indices, secuencia). |
| `002_SP_Sistema_Ping.sql` | Procedimiento `dbo.SP_Sistema_Ping` usado por el endpoint `/health`. |
| `003_Security.sql` | Login/usuario de aplicacion `shopcart_app` (solo `EXECUTE` sobre `dbo`) y blindaje de `dbo.Bitacora` como append-only (DENY UPDATE/DELETE + trigger `TR_Bitacora_Inmutable`). |
| `004_Catalogos.sql` | Datos base: roles (Cliente, Operador, Administrador), tipos de movimiento de inventario, parametros de configuracion (incluye `STOCK_MINIMO` = 5, umbral de bajo stock) e indice `IX_Usuario_Rol`. |
| `005_SP_Auth.sql` | SPs de autenticacion (RF-01): registro de cliente, consulta por correo/ID, intentos fallidos y lockout, login exitoso, y ciclo de refresh tokens (guardar, rotar con deteccion de reutilizacion, revocar). |
| `006_SP_Usuarios.sql` | SPs de gestion de usuarios por Administrador: listar (paginado/filtrado), crear, cambiar rol, cambiar estado. |
| `007_SP_Direcciones.sql` | SPs de direcciones del usuario (ownership validado en el SP): listar, obtener, crear, actualizar, desactivar (baja logica). |
| `008_VW_Inventario.sql` | Vista `VW_Inventario_Disponible` (Disponible = Existencia - reservas activas), indice `IX_Producto_Nombre` y tipo de tabla `TVP_VarianteAtributo`. |
| `009_SP_Categorias.sql` | SPs de categorias del catalogo (RF-02): listar (con conteo de productos activos), crear, actualizar, cambiar estado (baja logica). |
| `010_SP_Catalogo.sql` | SPs de productos, variantes e imagenes (RF-02): busqueda paginada, detalle, altas/cambios y gestion de imagenes. |
| `011_SP_Inventario.sql` | SPs de inventario y kardex (RF-03): registrar movimiento (unico que escribe Existencia), listar existencias, listar kardex y verificar consistencia. |
| `012_SP_Carrito.sql` | Carrito de compras (RF-04): `FU_Carrito_CalcularTotales` (totales e IVA en linea) y SPs obtener, agregar, actualizar, eliminar, vaciar y fusionar. El carrito solo lee el disponible (no reserva existencia). En M5 la funcion de totales descuenta el cupon vigente, por lo que se **reaplica despues de `014`**. |
| `013_Migracion_CarritoCupon.sql` | Migracion posterior al `001` (RF-05): agrega `Carrito.IDCupon` (nullable) y la FK `FK_Carrito_Cupon`, para que el carrito recuerde el cupon aplicado antes del checkout. Idempotente. |
| `014_SP_Cupones.sql` | Cupones (RF-05): `FU_Cupones_CalculoDescuento` y `FU_Cupones_Estado` (en linea) y SPs validar, aplicar/quitar al carrito y CRUD de administracion (listar, obtener, crear, actualizar, cambiar estado). No consume usos (eso es del checkout, M6). |
| `015_Catalogo_EstadosPedido.sql` | Estados de pedido (`EstadoPedido`) y transiciones permitidas (`TransicionEstadoPedido`) que gobiernan el ciclo de vida del pedido (RF-06, base de RF-07). Idempotente por codigo y por par origen/destino. |
| `016_SP_Checkout.sql` | Checkout y pago (RF-06): `SP_Inventario_ReservarExistencia` (interno), `SP_Checkout_Iniciar`, `SP_Checkout_Resumen`, `SP_Pedidos_CrearPedido` (pago simulado idempotente con replay) y `SP_Checkout_LiberarReservasVencidas` (job). Usa `SP_Inventario_RegistrarMovimiento` (`@OrigenInterno = 1`) para el kardex. |
| `017_Migracion_CarritoTokenUnico.sql` | Migracion posterior al `001` (RF-06): reemplaza `UQ_Carrito_TokenInvitado` (UNIQUE admite un solo NULL, rompia el segundo carrito de usuario) por el indice unico filtrado `UX_Carrito_TokenInvitado ... WHERE TokenInvitado IS NOT NULL`. Idempotente. |
| `018_SP_Pedidos.sql` | Pedidos y devoluciones (RF-07): `SP_Pedidos_CambiarEstado` (transiciones del grafo de `015` + cancelacion que repone inventario y devuelve el uso del cupon), `SP_Pedidos_RegistrarDevolucion` (TVP `TVP_DevolucionLinea`; parcial o total), `SP_Pedidos_Obtener`, `SP_Pedidos_Listar` y el trigger `TR_Pedido_TransicionValida`. Usa `SP_Inventario_RegistrarMovimiento` (CANCELACION/DEVOLUCION, `@OrigenInterno = 1`). |
| `099_Semillas.sql` | Datos de ejemplo para desarrollo (usuarios/direccion de M1; catalogo de M2; carga inicial de inventario de M3 via SP; carritos de M4 via SP; cupones de M5). Crece con cada modulo; se aplica al final. |

La numeracion sigue el patron `001`, `002`, `003`, ... Cada modulo de negocio
(catalogo, carrito, pedidos, etc.) agregara sus propios scripts con el siguiente
numero disponible. **No se reutilizan ni reordenan numeros ya publicados.**

> **Excepcion de orden en M5.** `012` se **reaplica despues** de `013` y `014`:
> `FU_Carrito_CalcularTotales` (en `012`) usa las funciones de cupon de `014` y la
> columna `Carrito.IDCupon` de `013`, y una funcion en linea exige que lo
> referenciado exista al momento de crearse. Orden de M5: **013 -> 014 -> 012 -> 099**.
>
> **M6.** Se **reaplican `004`** (agrega el parametro `RESERVA_JOB_SEGUNDOS`) y **`011`**
> (agrega el parametro `@SinResultado` a `SP_Inventario_RegistrarMovimiento`), y luego se
> aplican `015` y `016`. `016` usa `FU_Carrito_CalcularTotales`/`FU_Cupones_Estado`
> (012/014), `SP_Inventario_RegistrarMovimiento` (011) y los estados de `015`, todos ya
> presentes. Tambien se aplica `017`, migracion de modelo que corrige la unicidad
> del token de invitado (ver tabla). Orden de M6:
> **004 -> 011 -> 015 -> 016 -> 017 -> 099 (si cambio)**.
>
> **M7.** Se aplica `018` (pedidos, ciclo de vida y devoluciones) despues de `017`. Usa
> los estados de `015`, `SP_Inventario_RegistrarMovimiento` (011) y las tablas de pedido
> del `001`, todos ya presentes. Orden de M7: **018 -> 099 (si cambio)**.

## Como aplicarlos

Ejecutar cada archivo, en orden, con `sqlcmd` o SQL Server Management Studio.
Ejemplo con `sqlcmd`:

```bash
sqlcmd -S localhost -U sa -P "<password>" -i 001_CreateDatabase.sql
sqlcmd -S localhost -U sa -P "<password>" -i 002_SP_Sistema_Ping.sql
sqlcmd -S localhost -U sa -P "<password>" -i 003_Security.sql
sqlcmd -S localhost -U sa -P "<password>" -i 004_Catalogos.sql
sqlcmd -S localhost -U sa -P "<password>" -i 005_SP_Auth.sql
sqlcmd -S localhost -U sa -P "<password>" -i 006_SP_Usuarios.sql
sqlcmd -S localhost -U sa -P "<password>" -i 007_SP_Direcciones.sql
sqlcmd -S localhost -U sa -P "<password>" -i 008_VW_Inventario.sql
sqlcmd -S localhost -U sa -P "<password>" -i 009_SP_Categorias.sql
sqlcmd -S localhost -U sa -P "<password>" -i 010_SP_Catalogo.sql
sqlcmd -S localhost -U sa -P "<password>" -i 011_SP_Inventario.sql
# M5 (RF-05): 013 y 014 antes de reaplicar 012 (dependencia de funciones/columna).
sqlcmd -S localhost -U sa -P "<password>" -i 013_Migracion_CarritoCupon.sql
sqlcmd -S localhost -U sa -P "<password>" -i 014_SP_Cupones.sql
sqlcmd -S localhost -U sa -P "<password>" -i 012_SP_Carrito.sql
# M6 (RF-06): reaplicar 004 (nuevo parametro) y 011 (@SinResultado), luego estados y checkout.
sqlcmd -S localhost -U sa -P "<password>" -i 004_Catalogos.sql
sqlcmd -S localhost -U sa -P "<password>" -i 011_SP_Inventario.sql
sqlcmd -S localhost -U sa -P "<password>" -i 015_Catalogo_EstadosPedido.sql
sqlcmd -S localhost -U sa -P "<password>" -i 016_SP_Checkout.sql
sqlcmd -S localhost -U sa -P "<password>" -i 017_Migracion_CarritoTokenUnico.sql
# M7 (RF-07): pedidos, ciclo de vida y devoluciones.
sqlcmd -S localhost -U sa -P "<password>" -i 018_SP_Pedidos.sql
sqlcmd -S localhost -U sa -P "<password>" -i 099_Semillas.sql
```

> Los scripts con `CREATE OR ALTER` (como el `002`) y los idempotentes que
> comprueban existencia antes de crear (como el `003`) pueden reaplicarse sin
> error. El `001` esta pensado para una instancia sin la base `ShopCart` creada.

## Convencion de auditoria (bitacora)

Todo stored procedure que **escribe** datos recibe `@IDUsuarioEjecuta INT` como
un parametro tipado mas (puede ser `NULL` solo en el registro de clientes, donde
aun no hay actor) y, en su primera instruccion, publica ese valor en el contexto
de sesion:

```sql
EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;
```

Los triggers de bitacora leen al autor del cambio con
`SESSION_CONTEXT(N'IDUsuario')`. El backend no fija el contexto de sesion: solo
pasa `@IDUsuarioEjecuta` como un parametro mas al ejecutar el SP
(`request.input`).

## Parametros de tipo tabla (TVP)

El estandar de nomenclatura del reto no define tipos de tabla, asi que el
proyecto adopta la convencion propia `TVP_<Nombre>`. El unico TVP de M2 es
`dbo.TVP_VarianteAtributo` (`008_VW_Inventario.sql`), con columnas
`Nombre NVARCHAR(50)` y `Valor NVARCHAR(100)`; sirve para enviar el conjunto de
atributos de una variante en una sola llamada a `SP_Catalogo_CrearVariante` /
`SP_Catalogo_ActualizarVariante`. Como `CREATE TYPE` no admite `OR ALTER`, se
crea solo si no existe comprobando `sys.table_types`.
