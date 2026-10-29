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
| `DB_SERVER` | Host de SQL Server | `localhost` |
| `DB_PORT` | Puerto de SQL Server | `1433` |
| `DB_NAME` | Nombre de la base de datos | `ShopCart` |
| `DB_USER` | Usuario de SQL Server | `shopcart_app` |
| `DB_PASSWORD` | Contrasena de SQL Server | `ShopCart_Dev_2026!` |
| `DB_ENCRYPT` | Cifrar la conexion (`true`/`false`) | `true` |
| `DB_TRUST_SERVER_CERT` | Confiar en el certificado del servidor | `true` |
| `CORS_ORIGIN` | Origenes permitidos (separados por coma) | `http://localhost:5173` |
| `JWT_ACCESS_SECRET` | Secreto del access token (min. 32 chars) | `...` |
| `JWT_REFRESH_SECRET` | Secreto del refresh token (min. 32 chars) | `...` |
| `JWT_ACCESS_EXPIRES` | Vigencia del access token | `15m` |
| `JWT_REFRESH_EXPIRES` | Vigencia del refresh token | `7d` |
| `RESERVA_MINUTOS` | Minutos de vigencia de una reserva de stock | `15` |
| `CARRITO_ABANDONO_HORAS` | Horas para considerar un carrito abandonado | `24` |
| `IVA_PORCENTAJE` | Porcentaje de IVA aplicado | `12` |

## Scripts de base de datos

Pendiente. (Detalle de numeracion y orden de ejecucion en `db/README.md`.)

## Decisiones tecnicas

**Acceso a datos exclusivo por stored procedures.** El backend nunca arma SQL.
El unico punto de acceso es `executeSp(spName, params)` (`api/src/data/spExecutor.ts`),
que ejecuta `request.execute(spName)` con parametros tipados (`request.input`/
`request.output`). No existe `batch()`, `query()` ni cadenas con comandos SQL en
el codigo TypeScript. `assertIdentifier` valida el nombre del SP y de los
parametros como defensa adicional, aunque siempre provienen del codigo.

**Auditoria de bitacora via session context.** Todo SP que **escribe** datos
recibe `@IDUsuario INT` como un parametro tipado mas y, como primera instruccion,
publica ese valor en el contexto de sesion:

```sql
EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuario;
```

Los triggers de bitacora leen el autor con `SESSION_CONTEXT(N'IDUsuario')`. El
backend **no** fija el contexto de sesion por su cuenta: solo pasa `@IDUsuario`
dentro de `params`, como cualquier otro parametro del SP.

**Bitacora inmutable.** `dbo.Bitacora` es append-only. Ver
[Credenciales de prueba](#credenciales-de-prueba) y `db/scripts/003_Security.sql`:
el usuario de aplicacion solo tiene `EXECUTE` sobre `dbo` (sin permisos de tabla),
y un trigger `INSTEAD OF UPDATE, DELETE` bloquea cualquier modificacion o borrado,
incluso desde `dbo` o un SP.

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

## Ciclo de vida del pedido

Pendiente.
