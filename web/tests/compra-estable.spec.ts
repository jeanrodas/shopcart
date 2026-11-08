import { test, expect, type Page } from '@playwright/test';

/**
 * F9.4 — la compra NUNCA debe caer en /carrito tras un pago aprobado. Repite la compra
 * completa 10 veces por navegador alternando tres modos: (a) contexto nuevo con caché vacía
 * (simula "recargar"), (b) directo sin recarga, (c) con un cambio de foco/visibilidad justo
 * tras pulsar Pagar. Cada iteración debe terminar en /checkout/confirmacion/\d+ con "Pedido
 * confirmado" visible 3 s después, y jamás navegar a /carrito (se vigila con framenavigated).
 *
 * El flujo NO pasa por /carrito a propósito (producto → /checkout directo), para que cualquier
 * aparición de /carrito sea exactamente el bug.
 */

const N = 10;
const MODOS = ['recarga', 'directo', 'foco'] as const;
const PRODUCTO = '/producto/8'; // Filtro de Aceite: variante única de alto stock

async function entrar(page: Page) {
  await page.goto('/login');
  await page.getByPlaceholder('tucorreo@ejemplo.com').fill('cliente3@shopcart.local');
  await page.getByPlaceholder('Tu contraseña').fill('Cliente123!');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

async function comprar(page: Page, foco: boolean): Promise<void> {
  const carritoHits: string[] = [];
  const onNav = (f: { url(): string }) => {
    try {
      if (new URL(f.url()).pathname === '/carrito') carritoHits.push(f.url());
    } catch {
      /* url no parseable */
    }
  };
  page.on('framenavigated', onNav);
  try {
    await page.goto(PRODUCTO);
    await page.getByRole('button', { name: 'Agregar al carrito' }).click();
    await expect(page.getByRole('button', { name: /Agregado/ })).toBeVisible();

    // A /checkout DIRECTO (sin pasar por /carrito).
    await page.goto('/checkout');
    await expect(page.getByRole('button', { name: /^Pagar/ }).first()).toBeEnabled({ timeout: 30_000 });

    await page.getByRole('button', { name: /^Pagar/ }).first().click();
    if (foco) {
      // Cambio de foco/visibilidad justo tras pulsar Pagar (dispara refetchOnWindowFocus).
      await page.evaluate(() => {
        window.dispatchEvent(new Event('focus'));
        document.dispatchEvent(new Event('visibilitychange'));
      });
    }

    await page.waitForURL(/\/checkout\/confirmacion\/\d+/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible();
    // Sigue en la confirmación 3 s después (no hubo redirección tardía).
    await page.waitForTimeout(3000);
    await expect(page.getByRole('heading', { name: 'Pedido confirmado' })).toBeVisible();
    expect(new URL(page.url()).pathname).toMatch(/^\/checkout\/confirmacion\/\d+$/);
    expect(carritoHits, `navegó a /carrito: ${carritoHits.join(', ')}`).toHaveLength(0);
  } finally {
    page.off('framenavigated', onNav);
  }
}

test('compra estable: 10 compras sin caer en /carrito (modos recarga/directo/foco)', async ({ browser }) => {
  test.setTimeout(300_000);

  // Contexto persistente para los modos "directo" y "foco" (una sola sesión).
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await entrar(page);

  let ok = 0;
  for (let i = 0; i < N; i++) {
    const modo = MODOS[i % MODOS.length];
    if (modo === 'recarga') {
      // Contexto nuevo con caché vacía (equivale a recargar completo antes de comprar).
      const limpio = await browser.newContext();
      const p = await limpio.newPage();
      try {
        await entrar(p);
        await comprar(p, false);
      } finally {
        await limpio.close();
      }
    } else {
      await comprar(page, modo === 'foco');
    }
    ok += 1;
  }
  await ctx.close();
  expect(ok, 'todas las iteraciones deben terminar en la confirmación').toBe(N);
});
