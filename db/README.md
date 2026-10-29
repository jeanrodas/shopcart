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
| `004_Catalogos.sql` | Datos base: roles (Cliente, Operador, Administrador), tipos de movimiento de inventario, parametros de configuracion e indice `IX_Usuario_Rol`. |
| `005_SP_Auth.sql` | SPs de autenticacion (RF-01): registro de cliente, consulta por correo/ID, intentos fallidos y lockout, login exitoso, y ciclo de refresh tokens (guardar, rotar con deteccion de reutilizacion, revocar). |
| `006_SP_Usuarios.sql` | SPs de gestion de usuarios por Administrador: listar (paginado/filtrado), crear, cambiar rol, cambiar estado. |
| `007_SP_Direcciones.sql` | SPs de direcciones del usuario (ownership validado en el SP): listar, obtener, crear, actualizar, desactivar (baja logica). |
| `008_VW_Inventario.sql` | Vista `VW_Inventario_Disponible` (Disponible = Existencia - reservas activas), indice `IX_Producto_Nombre` y tipo de tabla `TVP_VarianteAtributo`. |
| `009_SP_Categorias.sql` | SPs de categorias del catalogo (RF-02): listar (con conteo de productos activos), crear, actualizar, cambiar estado (baja logica). |
| `010_SP_Catalogo.sql` | SPs de productos, variantes e imagenes (RF-02): busqueda paginada, detalle, altas/cambios y gestion de imagenes. |
| `099_Semillas.sql` | Datos de ejemplo para desarrollo (usuarios/direccion de M1; categorias, productos, variantes e imagenes de M2). Crece con cada modulo; se aplica al final. |

La numeracion sigue el patron `001`, `002`, `003`, ... Cada modulo de negocio
(catalogo, carrito, pedidos, etc.) agregara sus propios scripts con el siguiente
numero disponible. **No se reutilizan ni reordenan numeros ya publicados.**

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
