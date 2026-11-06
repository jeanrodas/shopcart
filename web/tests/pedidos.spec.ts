import { test, expect } from '@playwright/test';

/**
 * Pantalla 5 (F2): login cliente -> Mis pedidos muestra el resumen y al menos un pedido ->
 * Ver detalle muestra la linea de tiempo con el hito actual -> cancelar un pedido cancelable
 * desde la lista (modal -> confirmar) deja la tarjeta en "Cancelado".
 * Asume API en :3000 y Vite en :5173 ya corriendo, y la BD recien instalada (semillas).
 */
test('mis pedidos: resumen, detalle con linea de tiempo y cancelacion', async ({ page }) => {
  // 1) Login como cliente.
  await page.goto('/login');
  await page.getByPlaceholder('tucorreo@ejemplo.com').fill('cliente@shopcart.local');
  await page.getByPlaceholder('Tu contraseña').fill('Cliente123!');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  // "Cerrar sesión" existe en el encabezado y en el pie; basta con el del encabezado.
  await expect(page.getByRole('banner').getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();

  // 2) Mis pedidos: tarjetas de resumen y al menos un pedido.
  await page.goto('/mis-pedidos');
  await expect(page.getByRole('heading', { name: 'Mis pedidos', level: 1 })).toBeVisible();
  await expect(page.getByText('En camino', { exact: true })).toBeVisible();
  await expect(page.getByText('En preparación', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Total comprado', { exact: true })).toBeVisible();

  const tarjetas = page.locator('article');
  await expect(tarjetas.first()).toBeVisible();
  expect(await tarjetas.count()).toBeGreaterThanOrEqual(1);

  // 2b) Un pedido ENTREGADO no ofrece "Cancelar pedido"; uno EN_PREPARACION si.
  // Se localiza cada tarjeta por su numero (semillas: SC-000007 ENTREGADO, SC-000004 EN_PREPARACION)
  // porque la mini barra de progreso repite el texto "Entregado" en todas las tarjetas activas.
  const entregado = page.locator('article').filter({ has: page.getByRole('link', { name: 'SC-000007' }) });
  await expect(entregado).toBeVisible();
  await expect(entregado.getByRole('button', { name: 'Cancelar pedido' })).toHaveCount(0);

  const enPreparacion = page.locator('article').filter({ has: page.getByRole('link', { name: 'SC-000004' }) });
  await expect(enPreparacion.getByRole('button', { name: 'Cancelar pedido' })).toBeVisible();

  // 3) Ver detalle del primer pedido -> linea de tiempo con los hitos.
  await page.getByRole('button', { name: 'Ver detalle' }).first().click();
  await expect(page).toHaveURL(/\/mis-pedidos\/\d+$/);
  await expect(page.getByRole('heading', { name: /^Pedido SC-/ })).toBeVisible();
  await expect(page.getByText('Pagado', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Productos' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Historial' })).toBeVisible();

  // 4) Volver a la lista y cancelar un pedido cancelable.
  await page.goto('/mis-pedidos');
  const tarjetaCancelable = page
    .locator('article')
    .filter({ has: page.getByRole('button', { name: 'Cancelar pedido' }) })
    .first();
  await expect(tarjetaCancelable).toBeVisible();
  const numero = (await tarjetaCancelable.locator('a[href^="/mis-pedidos/"]').first().textContent())?.trim() ?? '';
  expect(numero).toMatch(/^SC-/);

  await tarjetaCancelable.getByRole('button', { name: 'Cancelar pedido' }).click();

  // Modal de confirmacion.
  const dialogo = page.getByRole('dialog');
  await expect(dialogo).toBeVisible();
  await expect(dialogo.getByText(`¿Cancelar el pedido ${numero}?`)).toBeVisible();
  await dialogo.getByRole('button', { name: 'Sí, cancelar' }).click();

  // 5) Tras el refetch, la tarjeta de ese pedido muestra el chip "Cancelado".
  const tarjetaCancelada = page.locator('article').filter({ hasText: numero });
  await expect(tarjetaCancelada.getByText('Cancelado', { exact: true })).toBeVisible();
});
