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
| `099_Semillas.sql` | Datos de ejemplo (usuarios/direccion de M1 y catalogo de M2). Se aplica al final. |

```bash
sqlcmd -S localhost -U sa -P "<password>" -i db/scripts/004_Catalogos.sql
sqlcmd -S localhost -U sa -P "<password>" -i db/scripts/005_SP_Auth.sql
sqlcmd -S localhost -U sa -P "<password>" -i db/scripts/006_SP_Usuarios.sql
sqlcmd -S localhost -U sa -P "<password>" -i db/scripts/007_SP_Direcciones.sql
sqlcmd -S localhost -U sa -P "<password>" -i db/scripts/008_VW_Inventario.sql
sqlcmd -S localhost -U sa -P "<password>" -i db/scripts/009_SP_Categorias.sql
sqlcmd -S localhost -U sa -P "<password>" -i db/scripts/010_SP_Catalogo.sql
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

## Pruebas con Postman

La coleccion `docs/postman/ShopCart.postman_collection.json` cubre M1 y M2.

1. Importela en Postman (boton **Import**). No requiere un entorno aparte: las
   variables viven en la coleccion (`baseUrl`, tokens por rol e IDs que los
   requests capturan solos). Ajuste `baseUrl` si la API no corre en
   `http://localhost:3000`.
2. Carpetas, en orden sugerido: **Auth** -> **Usuarios (Administrador)** ->
   **Direcciones (Cliente)** -> **Casos negativos** -> **M2 Catalogo**.
3. Cada carpeta inicia sesion y guarda los tokens/IDs que necesita, de modo que
   puede ejecutarse con el **Collection Runner** de principio a fin tras aplicar
   los scripts `001`-`010` y `099` en SQL Server.

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
