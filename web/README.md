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

## Estructura

- `src/api` — cliente HTTP (tokens, refresh single-flight, errores) y llamadas por módulo.
- `src/auth` — contexto de sesión, hook `useAuth` y `RutaProtegida`.
- `src/componentes/ui` — componentes reutilizables (Boton, Campo, TarjetaProducto, …).
- `src/componentes/layout` — layout de la tienda y barra inferior móvil.
- `src/paginas` — páginas (Inicio con sus secciones, Login y placeholders).
- `public/img` — imágenes servidas por el front (hero y productos).
