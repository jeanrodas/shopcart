import { test, expect, type Request } from '@playwright/test';

const API = 'http://localhost:3000';

/**
 * F4.3: al cerrar sesion el badge del carrito debe caer a 0 (o al del invitado), el
 * encabezado debe volver a "Iniciar sesión", y ninguna peticion posterior al cierre
 * debe llevar Authorization del usuario.
 */
test('cerrar sesion limpia el badge y no manda Authorization', async ({ page }) => {
  // 1) Login como cliente (via formulario; no depende del modo demo).
  await page.goto('/login');
  await page.getByPlaceholder('tucorreo@ejemplo.com').fill('cliente@shopcart.local');
  await page.getByPlaceholder('Tu contraseña').fill('Cliente123!');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  // El chip del usuario (menu desplegable) confirma la sesion iniciada.
  await expect(page.getByRole('banner').getByRole('button', { name: 'Menú de usuario' })).toBeVisible();

  // 2) Agregar 1 unidad de la variante del producto 1.
  await page.goto('/producto/1');
  await page.getByRole('button', { name: 'Agregar al carrito' }).click();
  await expect(page.getByRole('button', { name: 'Agregado ✓' })).toBeVisible();

  // 3) El badge del encabezado marca el conteo (1 o el del carrito sembrado).
  const badge = page.locator('header a[aria-label^="Carrito"] > span');
  await expect(badge).toHaveText(/\d+/);
  const conteo = Number(((await badge.textContent()) ?? '').trim());
  expect(conteo).toBeGreaterThanOrEqual(1);

  // 4) A partir de aqui, ninguna peticion a la API debe llevar Authorization.
  const conAuth: string[] = [];
  let capturando = false;
  page.on('request', (req: Request) => {
    if (!capturando || !req.url().startsWith(API)) return;
    if (req.headers()['authorization']) conAuth.push(`${req.method()} ${req.url()}`);
  });

  // Abrir el menu del usuario (sin peticiones) y luego empezar a capturar antes de cerrar sesion.
  await page.getByRole('banner').getByRole('button', { name: 'Menú de usuario' }).click();
  capturando = true;
  await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();

  // 5) Encabezado de invitado y badge en 0 (no se renderiza).
  await expect(
    page.locator('header').getByRole('link', { name: 'Iniciar sesión' }).first(),
  ).toBeVisible();
  await expect(badge).toHaveCount(0);

  // Esperar a que termine el refetch del carrito de invitado y revisar las peticiones.
  await page.waitForTimeout(500);
  expect(conAuth, `peticiones con Authorization tras cerrar sesion:\n${conAuth.join('\n')}`).toEqual(
    [],
  );
});

/** F6.1: el menu del usuario en el encabezado abre y "Mi cuenta" navega a /cuenta. */
test('el menu del usuario abre y lleva a Mi cuenta', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('tucorreo@ejemplo.com').fill('cliente@shopcart.local');
  await page.getByPlaceholder('Tu contraseña').fill('Cliente123!');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();

  const chip = page.getByRole('banner').getByRole('button', { name: 'Menú de usuario' });
  await expect(chip).toBeVisible();
  await expect(chip).toHaveAttribute('aria-expanded', 'false');
  await chip.click();
  await expect(chip).toHaveAttribute('aria-expanded', 'true');

  await page.getByRole('menuitem', { name: 'Mi cuenta' }).click();
  await expect(page).toHaveURL(/\/cuenta$/);
  await expect(page.getByRole('heading', { name: 'Datos personales' })).toBeVisible();
});
