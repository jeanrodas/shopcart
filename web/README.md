# ShopCart — Frontend (`web/`)

Tienda de ShopCart (Gasolineras Don Arturo): React 18 + Vite + TypeScript (strict).

## Requisitos

- Node >= 24
- La API de ShopCart corriendo (ver el README raíz). CORS ya permite `http://localhost:5173`.

## Cómo correr

```bash
cd web
npm install
cp .env.example .env     # VITE_API_URL=http://localhost:3000 (sin barra final; el front agrega /api/v1)
npm run dev              # http://localhost:5173
```

## Scripts

| Script | Qué hace |
|--------|----------|
| `npm run dev` | Servidor de desarrollo (Vite) en el puerto 5173. |
| `npm run build` | Chequeo de tipos (`tsc --noEmit`) + build de producción (`vite build`). |
| `npm run preview` | Sirve la build de producción. |
| `npm run lint` | ESLint (flat config). |
| `npm run typecheck` | Solo chequeo de tipos. |

## Pruebas de navegador (Playwright)

Prueban flujos completos en un navegador real (`web/tests/*.spec.ts`), incluida la prueba de
humo de la compra (`compra.spec.ts`) y el dashboard en vivo (`dashboard.spec.ts`).

**Requisitos:**

- La **API** (`:3000`) y **Vite** (`:5173`) ya corriendo (la config no levanta servidores).
- La **BD sembrada** (`db/aplicar.ps1`, incluye `099`); varias pruebas compran/mutan datos.
- **`RATE_LIMIT_AUTH_MAX=400` en `api/.env`** mientras corren las pruebas: la suite hace ~25
  inicios de sesión y cada `page.goto` renueva el access con `/auth/refresh`, que comparte ese
  limitador; con el default saltaría `429` en las últimas pruebas. (Déjalo en 400 solo para
  correr la suite; `api/.env` es local y no se versiona.) `global-setup.ts` hace un login de
  prueba y avisa por consola si detecta `429`.

La suite **asume semillas frescas**: varias pruebas mutan datos sembrados (ver "Limitaciones"
abajo). Dos scripts:

```bash
cd web
npm run test:e2e        # reinstala la BD (db/reinstalar -Force) y luego corre toda la suite
npm run test:e2e:solo   # solo playwright (sin reinstalar), para iterar
npx playwright test compra   # un archivo suelto
```

- **`npm run test:e2e`** garantiza el estado limpio: llama a `db/reinstalar.ps1 -Force` (DROP +
  `aplicar`) y luego `playwright test`. Úsalo para una pasada 100 % verde.
- **`npm run test:e2e:solo`** no reinstala; útil mientras desarrollas una prueba, pero las que
  "requieren semillas frescas" pueden fallar si ya corriste la suite antes.
- `global-setup.ts` comprueba `/health`, hace **un** login y avisa por consola si hay `429`
  (sube `RATE_LIMIT_AUTH_MAX` a 400 en `api/.env`), y además avisa si la BD lleva **más de 60
  min** instalada (lee `instalacion` del evento SSE `hola` = `SP_Sistema_Instalacion`): las
  semillas podrían estar mutadas y conviene `npm run test:e2e`.

Las pruebas corren **en serie** (`workers: 1`, `fullyParallel: false`) porque **comparten
estado** (misma BD y sesión); así `npx playwright test` sin parámetros pasa de forma estable.
`chromium` corre la suite completa y `firefox` solo las de compra (`compra` / `compra-estable`).

### Limitaciones conocidas

- **Pruebas que requieren semillas frescas (no idempotentes):** `admin.spec` (edita productos/
  variantes sembrados), `operacion.spec` (transiciona pedidos sembrados y registra una
  devolución) y `pedidos.spec` (lee/cancela pedidos sembrados por número). Están marcadas en su
  cabecera y pasan bajo `npm run test:e2e`. `cuenta.spec` y `control.spec` se hicieron
  idempotentes (valores únicos por corrida); `compra`/`compra-estable`/`pedidos-vivo`/`dashboard`
  crean sus propios datos (producto 8 de alto stock, cliente3) y no dependen del estado inicial.
- **Badge del carrito tras un segundo login (F4.3):** corregido en C1 — `iniciarSesion`
  invalida `['carrito']` tras la fusión, así el badge recupera el conteo del usuario. Cubierto
  por `sesion.spec` ("el badge del carrito vuelve tras un segundo login").

## Estructura

- `src/api` — cliente HTTP (tokens, refresh single-flight, errores) y llamadas por módulo.
- `src/auth` — contexto de sesión, hook `useAuth` y `RutaProtegida`.
- `src/componentes/ui` — componentes reutilizables (Boton, Campo, TarjetaProducto, …).
- `src/componentes/layout` — layout de la tienda y barra inferior móvil.
- `src/paginas` — páginas (Inicio con sus secciones, Login y placeholders).
- `public/img` — imágenes servidas por el front (hero y productos).
