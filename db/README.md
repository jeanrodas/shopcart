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
```

> Los scripts con `CREATE OR ALTER` (como el `002`) y los idempotentes que
> comprueban existencia antes de crear (como el `003`) pueden reaplicarse sin
> error. El `001` esta pensado para una instancia sin la base `ShopCart` creada.

## Convencion de auditoria (bitacora)

Todo stored procedure que **escribe** datos recibe `@IDUsuario INT` como un
parametro tipado mas y, en su primera instruccion, publica ese valor en el
contexto de sesion:

```sql
EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuario;
```

Los triggers de bitacora leen al autor del cambio con
`SESSION_CONTEXT(N'IDUsuario')`. El backend no fija el contexto de sesion: solo
pasa `@IDUsuario` como un parametro mas al ejecutar el SP (`request.input`).
