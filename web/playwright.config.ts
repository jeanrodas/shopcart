import { defineConfig, devices } from '@playwright/test';

/**
 * Prueba de navegador de ShopCart. Asume la API en :3000 y Vite en :5173 ya corriendo
 * (no se levanta un webServer aqui). Viewport de escritorio para que el encabezado
 * muestre los botones "Cerrar sesión" / "Iniciar sesión" (ocultos en < lg).
 */
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  // Las pruebas comparten estado (misma BD/sesion), por eso corren en serie: 1 worker y sin
  // paralelismo dentro de un archivo. Asi `npx playwright test` sin parametros pasa.
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:5173',
    ...devices['Desktop Chrome'],
  },
});
