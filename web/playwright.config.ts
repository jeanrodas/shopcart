import { defineConfig, devices } from '@playwright/test';

/**
 * Prueba de navegador de ShopCart. Asume la API en :3000 y Vite en :5173 ya corriendo
 * (no se levanta un webServer aqui). Viewport de escritorio para que el encabezado
 * muestre los botones "Cerrar sesión" / "Iniciar sesión" (ocultos en < lg).
 */
export default defineConfig({
  testDir: './tests',
  // Chequeo previo: avisa si el limitador de /auth esta saturado (ver tests/global-setup.ts).
  globalSetup: './tests/global-setup.ts',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: 'list',
  // Las pruebas comparten estado (misma BD/sesion), por eso corren en serie: 1 worker y sin
  // paralelismo dentro de un archivo. Asi `npx playwright test` sin parametros pasa.
  workers: 1,
  fullyParallel: false,
  use: {
    baseURL: 'http://localhost:5173',
  },
  // Dos navegadores (instalar firefox con `npx playwright install firefox`). Con workers:1
  // ambos proyectos corren en serie (comparten BD/sesion). chromium corre la suite COMPLETA;
  // firefox corre solo las pruebas de la COMPRA (compra / compra-estable), que es el foco de
  // F9.4 y donde el fallo aparecía en Firefox: así se valida el checkout en ambos navegadores
  // sin ejecutar DOS veces las pruebas que mutan las semillas (no son idempotentes en una sola
  // BD y el protocolo prohíbe reinstalar a mitad de la corrida). Esas pruebas de compra usan
  // una variante de alto stock, por lo que no agotan existencia aunque corran en ambos.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testMatch: /compra(-estable)?\.spec\.ts$/ },
  ],
});
