# Base de datos — ShopCart

Scripts SQL de ShopCart y su instalador. La logica de negocio vive en stored
procedures; el backend solo los ejecuta.

## Requisitos

- **SQL Server 2022** (se usa `DATETRUNC`, disponible desde 2022).
- **`sqlcmd`** del cliente **ODBC 18** o **go-sqlcmd**. El instalador invoca `sqlcmd`
  con `-C` (confiar en el certificado del servidor, requerido por ODBC 18) y `-b`
  (abortar al primer error del script).

## Instalacion limpia (un comando)

Sobre una instancia **sin** la base `ShopCart`, desde la carpeta `db/`:

```powershell
.\aplicar.ps1                         # Windows auth contra localhost, con semillas
.\aplicar.ps1 -Server "host\INSTANCIA"
.\aplicar.ps1 -User sa -Password '<pass>' -IncluirSemillas:$false
```

Equivalente en bash: `./aplicar.sh` (opciones `-s/--server`, `-u/--user`, `-p/--password`,
`--sin-semillas`). El instalador aplica los scripts en el **orden canonico unico**
definido en una sola lista dentro de `aplicar.ps1`/`aplicar.sh`, se detiene en el primer
error mostrando el script, y al final imprime conteos de verificacion (26 tablas,
procedimientos, triggers, vistas y el login `shopcart_app`).

### Clave del login de aplicacion (produccion)

`003_Security.sql` crea el login `shopcart_app` con una contrasena **fija de desarrollo**
(`ShopCart_Dev_2026!`) y usa `IF NOT EXISTS`, por lo que reaplicar `003` no la pisa. Para
produccion, pase otra contrasena con `-AppPassword` (PowerShell) / `-a|--app-password`
(bash): tras aplicar todos los scripts, el instalador ejecuta
`ALTER LOGIN shopcart_app WITH PASSWORD = N'$(AppPassword)'` pasando el valor como
**variable de `sqlcmd` (`-v`)**, no concatenado en el texto (la clave no debe contener
comillas simples). Debe coincidir con `DB_PASSWORD` de la API.

```powershell
.\aplicar.ps1 -User sa -Password '<sa>' -AppPassword '<clave-app>'
```
```bash
./aplicar.sh -u sa -p '<sa>' -a '<clave-app>'
```

En contenedor, `aplicar.sh` resuelve `sqlcmd` del `PATH` o de `/opt/mssql-tools18/bin`
(cliente ODBC 18 de la imagen de SQL Server 2022). Lo usa `deploy/instalar-bd.sh`.

### Orden canonico y el equivalente manual

```
001 002 003 004 005 006 007 008 009 010 011 013 014 012 015 016 017 018 019 020 021 [099]
```

`012` va **despues** de `013` y `014`: `FU_Carrito_CalcularTotales` (en `012`) referencia
la columna `Carrito.IDCupon` (que agrega `013`) y las funciones de cupon (`014`), y una
funcion en linea exige que lo referenciado exista al momento de crearse. El `099`
(semillas) es opcional y va al final. Equivalente manual con `sqlcmd` (una linea por
script, en ese orden):

```bash
sqlcmd -S localhost -E -C -b -i scripts/001_CreateDatabase.sql
sqlcmd -S localhost -E -C -b -i scripts/002_SP_Sistema_Ping.sql
# ... continuar en el orden de arriba hasta 021, y 099 al final.
```

## Idempotencia

- **`001_CreateDatabase.sql` NO es idempotente**: crea la base y el modelo; se aplica
  una sola vez sobre una instancia que todavia no tiene la base `ShopCart`.
- **El resto es reaplicable**: los SPs, funciones, vistas y triggers usan
  `CREATE OR ALTER`; los datos (`004`, `015`, `099`) y los indices/migraciones
  (`013`, `017`, el indice de `020`) comprueban existencia antes de crear o insertar.
  `099` ademas salta su seccion de pedidos demo si ya existe el pago `SEED-001`.

## Avisos esperados (no son errores)

- **`014`:** SQL Server emite "The module 'SP_Cupones_AplicarACarrito'/'SP_Cupones_QuitarDeCarrito'
  depends on the missing object 'dbo.SP_Carrito_Obtener'… will still be created". Es
  normal: en el orden canonico `012` (que crea `SP_Carrito_Obtener`) se aplica **despues**
  de `014`. La resolucion de dependencias es diferida; los modulos quedan correctos.
- **`099`:** al generar los pedidos de demostracion llama a los SPs de checkout, cambio de
  estado y devolucion, que **devuelven result sets**; `sqlcmd` los imprime (`(N rows
  affected)` y tablas). Es ruido de salida, no un error; la verificacion final aparece al
  terminar.

## Scripts

| Script | Descripcion |
|--------|-------------|
| `001_CreateDatabase.sql` | Base de datos `ShopCart` y modelo relacional: 26 tablas, constraints, indices y la secuencia del numero de pedido. |
| `002_SP_Sistema_Ping.sql` | `SP_Sistema_Ping` para el endpoint `/health`. |
| `003_Security.sql` | Login/usuario `shopcart_app` (solo `EXECUTE` sobre `dbo`) y blindaje append-only de `dbo.Bitacora` (DENY UPDATE/DELETE + trigger `TR_Bitacora_Inmutable`). |
| `004_Catalogos.sql` | Datos base: roles, tipos de movimiento de inventario, parametros (`dbo.Parametro`) e indice `IX_Usuario_Rol`. |
| `005_SP_Auth.sql` | Autenticacion (RF-01): registro, consulta por correo/ID, intentos fallidos y lockout, login exitoso, ciclo de refresh tokens. |
| `006_SP_Usuarios.sql` | Gestion de usuarios por Administrador: listar, crear, cambiar rol, cambiar estado (ambos revocan refresh tokens). |
| `007_SP_Direcciones.sql` | Direcciones del usuario (ownership en el SP; dir. ajena -> 404 uniforme). |
| `008_VW_Inventario.sql` | Vista `VW_Inventario_Disponible`, indice `IX_Producto_Nombre` y el TVP `TVP_VarianteAtributo`. |
| `009_SP_Categorias.sql` | Categorias del catalogo (RF-02). |
| `010_SP_Catalogo.sql` | Productos, variantes e imagenes (RF-02). |
| `011_SP_Inventario.sql` | Inventario y kardex (RF-03): `SP_Inventario_RegistrarMovimiento` (unico que escribe `Existencia`), existencias, kardex y verificacion de consistencia. |
| `013_Migracion_CarritoCupon.sql` | Migracion: agrega `Carrito.IDCupon` + FK (RF-05). |
| `014_SP_Cupones.sql` | Funciones y SPs de cupones (RF-05): validar, aplicar/quitar al carrito y CRUD de administracion. |
| `012_SP_Carrito.sql` | Carrito (RF-04): `FU_Carrito_CalcularTotales` y SPs del carrito. Se aplica despues de `013`/`014` (ver orden canonico). |
| `015_Catalogo_EstadosPedido.sql` | `EstadoPedido` y `TransicionEstadoPedido`: grafo del ciclo de vida (RF-06/07). |
| `016_SP_Checkout.sql` | Checkout y pago (RF-06): reserva, `SP_Checkout_Iniciar`/`_Resumen`, `SP_Pedidos_CrearPedido` (pago simulado idempotente), liberacion de reservas. |
| `017_Migracion_CarritoTokenUnico.sql` | Migracion: indice unico filtrado para el token de invitado (tolera multiples NULL). |
| `018_SP_Pedidos.sql` | Pedidos y devoluciones (RF-07): cambio de estado, cancelacion, devolucion (TVP), consulta/listado y el trigger `TR_Pedido_TransicionValida`. |
| `019_Bitacora.sql` | Bitacora de auditoria (RF-09): triggers set-based en Producto/Variante/Kardex/Cupon/PedidoHistorialEstado/Devolucion, consulta (`SP_Bitacora_Consultar`), modulos y helper. Solo `INSERT`. |
| `020_Reportes.sql` | Dashboard y reportes (RF-08): vistas de venta neta y SPs de ventas por periodo/categoria, top productos, carritos abandonados y resumen con comparativo; indice `IX_Devolucion_Pedido_Monto`. |
| `021_SP_Catalogo_Publico.sql` | SPs publicos para la tienda: `SP_Cupones_Vigentes` y `SP_Catalogo_Destacados` (mas vendidos + ofertas). Solo lectura. |
| `099_Semillas.sql` | Datos de ejemplo: usuarios/direccion, catalogo, inventario, carritos, cupones y ~12 pedidos de demostracion (M6-M9) con fechas repartidas en 60 dias. Opcional. |

## Convenciones

- **Nomenclatura.** Tablas en singular PascalCase, PK `IDNombre`, montos `DECIMAL(18,2)`,
  fechas `DATETIME2(0)` en UTC. SPs `SP_Modulo_Accion`, funciones `FU_...`, vistas `VW_...`,
  triggers `TR_...`, tipos de tabla `TVP_...`.
- **Errores de negocio `50400`–`50499`.** El numero codifica el HTTP (`50404` -> 404,
  `50409` -> 409, `50422` -> 422); el backend lo traduce. Mensajes en espanol sin acentos.
- **Auditoria por `SESSION_CONTEXT`.** Todo SP que escribe recibe `@IDUsuarioEjecuta` y,
  como primera instruccion, `EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuarioEjecuta;`.
  Los triggers de bitacora leen al autor con `SESSION_CONTEXT(N'IDUsuario')`; el backend
  solo pasa el parametro, no fija el contexto.
- **`XACT_ABORT ON`** en los SPs con transaccion; `TRY/CATCH` con `ROLLBACK` si
  `@@TRANCOUNT > 0` y `;THROW;`. `SET NOCOUNT ON` en todos.
- **Sin SQL dinamico** (ni `sp_executesql` ni `EXEC(...)`): las combinaciones de filtros
  usan el patron `(@P IS NULL OR ...)` con `OPTION (RECOMPILE)`.
- **TVP.** El estandar del reto no define tipos de tabla; el proyecto adopta `TVP_<Nombre>`
  (`TVP_VarianteAtributo` en `008`, `TVP_DevolucionLinea` en `018`). Como `CREATE TYPE` no
  admite `OR ALTER`, se crean comprobando `sys.table_types`.

## Evolucion por modulo (historial)

Las migraciones y reaplicaciones que en su momento se hicieron modulo a modulo ya estan
plegadas en el orden canonico unico de arriba; no hace falta reaplicar `004`/`011`/`012`
a mano. Se dejan como historial:

- **M5 (RF-05).** Introdujo `013` (columna `Carrito.IDCupon`) y `014` (cupones), y obligo a
  colocar `012` despues de ambos.
- **M6 (RF-06).** Amplio `004` (parametro `RESERVA_JOB_SEGUNDOS`) y `011` (parametro
  `@SinResultado`), y agrego `015`, `016` y la migracion `017`.
- **M7 (RF-07).** Agrego `018` (pedidos y devoluciones).
- **M8 (RF-09).** Agrego `019` (bitacora).
- **M9 (RF-08).** Agrego `020` (reportes) y amplio `099` con pedidos de demostracion.
