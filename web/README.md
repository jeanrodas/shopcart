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

```bash
cd web
npx playwright test          # toda la suite
npx playwright test compra   # un archivo
```

Las pruebas corren **en serie** (`workers: 1`, `fullyParallel: false`) porque **comparten
estado** (misma BD y sesión); así `npx playwright test` sin parámetros pasa de forma estable.

## Estructura

- `src/api` — cliente HTTP (tokens, refresh single-flight, errores) y llamadas por módulo.
- `src/auth` — contexto de sesión, hook `useAuth` y `RutaProtegida`.
- `src/componentes/ui` — componentes reutilizables (Boton, Campo, TarjetaProducto, …).
- `src/componentes/layout` — layout de la tienda y barra inferior móvil.
- `src/paginas` — páginas (Inicio con sus secciones, Login y placeholders).
- `public/img` — imágenes servidas por el front (hero y productos).
