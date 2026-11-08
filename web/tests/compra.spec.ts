import { test, expect, type Page } from '@playwright/test';

/**
 * Prueba de humo principal de la tienda (F9.1): la compra de punta a punta del cliente.
 * Asume API en :3000, Vite en :5173, BD recien instalada y MODO_DEMO/PAGO_SIMULADO on
 * (para elegir APROBADO/RECHAZADO). 1 worker (comparte estado).
 */
async function entrar(page: Page, correo: string, contrasena: string) {
  await page.goto('/login');
  await page.getByPlaceholder('tucorreo@ejemplo.com').fill(correo);
  await page.getByPlaceholder('Tu contraseña').fill(contrasena);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

async function agregarYhastaCheckout(page: Page) {
  // Producto 8 (Filtro de Aceite): variante unica de alto stock, para que la suite en dos
  // navegadores no agote existencia.
  await page.goto('/producto/8');
  await page.getByRole('button', { name: 'Agregar al carrito' }).click();
  // Badge del carrito en 1 (al menos una unidad).
  await expect(page.getByRole('link', { name: /Carrito, \d+ productos/ })).toBeVisible();
  await page.goto('/carrito');
  await page.getByRole('button', { name: 'Ir a pagar' }).first().click();
  await page.waitForURL(/\/checkout$/);
  // La reserva se inicia sola con la direccion preseleccionada; esperar al boton Pagar.
  await expect(page.getByRole('button', { name: /^Pagar/ }).first()).toBeEnabled({ timeout: 30_000 });
}

test('compra: pago aprobado lleva a la confirmacion con numero y total (prueba de humo)', async ({ page }) => {
  await entrar(page, 'cliente3@shopcart.local', 'Cliente123!');
  await agregarYhastaCheckout(page);

  // Facturacion CF (por defecto) y resultado APROBADO (por defecto en modo demo).
  await page.getByRole('button', { name: /^Pagar/ }).first().click();

  // Debe caer en la confirmacion (NO en /carrito).
  await page.waitForURL(/\/checkout\/confirmacion\/\d+/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible();
  const numero = (await page.getByText(/SC-\d{4,}/).first().innerText()).trim();
  expect(numero).toMatch(/^SC-0{0,}\d+$/);
  // Total cobrado visible (algun monto en Q).
  await expect(page.getByText(/Total cobrado/)).toBeVisible();

  // Badge del carrito en 0: en /mis-pedidos (marco de tienda) el carrito no muestra contador.
  await page.goto('/mis-pedidos');
  await expect(page.getByRole('link', { name: 'Carrito', exact: true })).toBeVisible();
  // El pedido aparece arriba con estado Pagado.
  await expect(page.getByText(numero).first()).toBeVisible();
  await expect(page.getByText('Pagado').first()).toBeVisible();
});

test('compra: pago rechazado deja un modal en la misma pagina y el carrito intacto', async ({ page }) => {
  await entrar(page, 'cliente3@shopcart.local', 'Cliente123!');
  await agregarYhastaCheckout(page);

  // Elegir resultado RECHAZADO (modo demo) y pagar.
  await page.getByText('Rechazado', { exact: true }).click();
  await page.getByRole('button', { name: /^Pagar/ }).first().click();

  // Modal de rechazo en la MISMA pagina; la URL sigue en /checkout.
  await expect(page.getByRole('heading', { name: 'No pudimos procesar el pago' })).toBeVisible({ timeout: 15_000 });
  expect(new URL(page.url()).pathname).toBe('/checkout');

  // Carrito intacto: aun hay una unidad reservada (el badge sigue mostrando contador).
  await page.getByRole('button', { name: 'Cambiar método de pago' }).click();
  await page.goto('/carrito');
  await expect(page.getByRole('link', { name: /Carrito, \d+ productos/ })).toBeVisible();
});
