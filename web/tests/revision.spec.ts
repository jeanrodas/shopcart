import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';

/**
 * Pruebas de la revision independiente (C2.1). Asumen API en :3000, Vite en :5173 y la BD
 * recien instalada (`npm run test:e2e`). Varias usan semillas de cupones (PROMO10, LUB50,
 * VENCIDO, AGOTADO). 1 worker (comparten estado).
 */
async function entrar(page: Page, correo: string, contrasena: string) {
  await page.goto('/login');
  await page.getByPlaceholder('tucorreo@ejemplo.com').fill(correo);
  await page.getByPlaceholder('Tu contraseña').fill(contrasena);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

/** Ejecuta un query en ShopCart con sqlcmd (autenticacion de Windows). Para preparar estado. */
function sql(query: string): void {
  execFileSync('sqlcmd', ['-S', 'localhost', '-E', '-d', 'ShopCart', '-C', '-b', '-I', '-Q', query], {
    stdio: 'pipe',
  });
}

test('cupones: vencido, agotado y bajo el minimo muestran la causa exacta de la API (E)', async ({ page }) => {
  await entrar(page, 'cliente@shopcart.local', 'Cliente123!');
  // Un lubricante barato (1 unidad < Q300) para que LUB50 falle por el monto minimo.
  await page.goto('/producto/1');
  await page.getByRole('button', { name: 'Agregar al carrito' }).click();
  await page.goto('/carrito');

  const caja = page.getByLabel('Cupón');
  const aplicar = page.getByRole('button', { name: 'Aplicar', exact: true });

  // VENCIDO -> causa de vigencia.
  await caja.fill('VENCIDO');
  await aplicar.click();
  await expect(page.getByText(/vencid|vigen/i).first()).toBeVisible({ timeout: 10_000 });

  // AGOTADO -> causa de limite de usos.
  await caja.fill('AGOTADO');
  await aplicar.click();
  await expect(page.getByText(/agotad|límite|limite|uso/i).first()).toBeVisible({ timeout: 10_000 });

  // LUB50 con carrito bajo el minimo -> causa de monto minimo (Q300).
  await caja.fill('LUB50');
  await aplicar.click();
  await expect(page.getByText(/mínimo|minimo|300/i).first()).toBeVisible({ timeout: 10_000 });
});

test('catalogo: filtros de precio y disponibilidad y paginacion desde la UI (E)', async ({ page }) => {
  await page.goto('/catalogo');
  await expect(page.getByRole('heading', { name: 'Catálogo', level: 1 })).toBeVisible();

  // Filtro de precio maximo (panel de escritorio) -> se refleja en la URL.
  await page.getByRole('spinbutton', { name: 'Máximo' }).fill('100');
  await page.getByRole('button', { name: 'Aplicar filtros' }).click();
  await expect(page).toHaveURL(/precioMax=100/);

  // Disponibilidad: "Solo con existencia" se aplica al instante y queda en la URL.
  await page.getByText('Solo con existencia').click();
  await expect(page).toHaveURL(/soloDisponibles=true/);

  // Paginacion: reducir el tamano de pagina y, si hay mas de una, ir a la 2.
  await page.goto('/catalogo');
  const selectorTamano = page.getByLabel(/por página/i);
  if (await selectorTamano.count()) {
    await selectorTamano.selectOption({ index: 0 }).catch(() => {});
  }
  const siguiente = page.getByRole('button', { name: /Siguiente/i });
  if ((await siguiente.count()) && (await siguiente.first().isEnabled())) {
    await siguiente.first().click();
    await expect(page).toHaveURL(/pagina=2/);
  }
});

test('checkout: la reserva vencida muestra el aviso y permite reservar de nuevo (E)', async ({ page }) => {
  test.setTimeout(90_000);
  await entrar(page, 'cliente3@shopcart.local', 'Cliente123!');
  await page.goto('/producto/8');
  await page.getByRole('button', { name: 'Agregar al carrito' }).click();
  await page.goto('/carrito');
  await page.getByRole('button', { name: 'Ir a pagar' }).first().click();
  await page.waitForURL(/\/checkout$/);
  await expect(page.getByRole('button', { name: /^Pagar/ }).first()).toBeEnabled({ timeout: 30_000 });

  // Vence la reserva del cliente en la BD (sin esperar los 15 min) y refresca por foco.
  sql(
    "UPDATE r SET r.Estado = N'Liberada', r.FechaExpira = DATEADD(MINUTE,-1,SYSUTCDATETIME()) " +
      'FROM dbo.Reserva r INNER JOIN dbo.Carrito c ON c.IDCarrito = r.IDCarrito ' +
      "INNER JOIN dbo.Usuario u ON u.IDUsuario = c.IDUsuario " +
      "WHERE u.Correo = N'cliente3@shopcart.local' AND r.Estado = N'Activa';",
  );
  // Simula el regreso a la pestaña hasta que el resumen de checkout (staleTime 30 s) quede
  // "stale" y el refetch por foco de react-query v5 detecte la reserva vencida. En headless el
  // documento suele reportarse "hidden", por eso también se fuerza visibilityState a "visible".
  await expect(async () => {
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
      window.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.getByRole('heading', { name: 'Tu reserva venció' })).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 45_000 });
  await expect(page.getByRole('button', { name: /Reservar de nuevo/ })).toBeVisible();
});

test('roles: el Operador en /admin no ve los bloques de negocio y /admin/cupones da 403 (B5)', async ({ page }) => {
  await entrar(page, 'operador@shopcart.local', 'Operador123!');
  await expect(page).toHaveURL(/\/admin$/);
  // El Operador ve lo operativo (Top productos / Ahora mismo) pero NO los bloques de negocio.
  await expect(page.getByText('Top productos')).toBeVisible();
  await expect(page.getByText('Ventas netas')).toHaveCount(0);
  await expect(page.getByText('Embudo de compra')).toHaveCount(0);

  // Cupones es solo Administrador: el Operador recibe la pagina 403.
  await page.goto('/admin/cupones');
  await expect(page).toHaveURL(/\/403$/);
});
