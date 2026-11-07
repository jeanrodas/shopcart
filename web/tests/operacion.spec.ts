import { test, expect, type Page } from '@playwright/test';

/**
 * F7 - Operacion del area interna (inventario y pedidos). Asume API en :3000, Vite en
 * :5173 y la BD recien instalada. 1 worker (las transiciones mutan estado compartido).
 */
async function entrar(page: Page, correo: string, contrasena: string) {
  await page.goto('/login');
  await page.getByPlaceholder('tucorreo@ejemplo.com').fill(correo);
  await page.getByPlaceholder('Tu contraseña').fill(contrasena);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  // Espera a que la sesion quede establecida (el login redirige fuera de /login).
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

test('operador: inventario — simular ajuste negativo (rojo) y registrar una entrada', async ({ page }) => {
  await entrar(page, 'operador@shopcart.local', 'Operador123!');
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto('/admin/inventario');
  await expect(page.getByRole('heading', { name: 'Inventario', level: 1 })).toBeVisible();

  // Aislar una variante por SKU y abrir su panel con "Entrada".
  await page.getByPlaceholder('Buscar por SKU o producto…').fill('ACC-FIL-UNIV-STD');
  const fila = page.locator('tbody tr').filter({ hasText: 'ACC-FIL-UNIV-STD' });
  await expect(fila).toHaveCount(1);
  await fila.getByRole('button', { name: 'Entrada' }).click();

  const panel = page.getByTestId('panel-inventario'); // panel sticky de escritorio
  await expect(panel.getByText('Registrar movimiento')).toBeVisible();

  // Motivo valido para aislar la regla de "permitido".
  await panel.locator('textarea').fill('Prueba F7 operacion inventario');

  // Ajuste negativo mayor al disponible -> resultado en rojo y boton deshabilitado.
  await panel.getByRole('button', { name: /Ajuste −/ }).click();
  await panel.getByRole('spinbutton').fill('99999');
  await expect(panel.getByTestId('sim-resultado')).toContainText('→');
  await expect(panel.getByRole('button', { name: 'Registrar ajuste' })).toBeDisabled();

  // Entrada de compra +5 -> permitido, registrar.
  await panel.getByRole('button', { name: 'Entrada de compra' }).click();
  await panel.getByRole('spinbutton').fill('5');
  const btnEntrada = panel.getByRole('button', { name: 'Registrar entrada' });
  await expect(btnEntrada).toBeEnabled();
  await btnEntrada.click();

  await expect(page.getByText('Entrada registrada')).toBeVisible();

  // El kardex del panel muestra el movimiento arriba (+5, ENTRADA_COMPRA).
  const primerKardex = panel.locator('ul li').first();
  await expect(primerKardex.getByText('ENTRADA_COMPRA')).toBeVisible();
  await expect(primerKardex.getByText('+5', { exact: true })).toBeVisible();

  // Y la fila de la tabla refleja el ultimo movimiento.
  await expect(fila.getByText(/ENTRADA_COMPRA \+5/)).toBeVisible();
});

test('operador: pedidos — preparar, despachar, entregar y registrar devolucion', async ({ page }) => {
  await entrar(page, 'operador@shopcart.local', 'Operador123!');
  await page.goto('/admin/pedidos');
  await expect(page.getByRole('heading', { name: 'Pedidos', level: 1 })).toBeVisible();

  // La tarjeta "Pagados" entra seleccionada por defecto (cola de trabajo): muestra todos los
  // PAGADO sin filtro de fecha. Selecciona un PAGADO conocido (SC-000002, de Cliente Dos; evita
  // el race de la fila "anterior" que mantiene keepPreviousData y no interfiere con otros specs).
  const fila = page.locator('tbody tr').filter({ hasText: 'SC-000002' });
  await fila.click();

  const panel = page.getByTestId('panel-pedidos');
  await expect(panel.getByText('Ver completo ↗')).toBeVisible();

  // Preparar (con comentario) -> aparece "Despachar".
  await panel.locator('textarea').first().fill('Preparado por operador (prueba F7)');
  await panel.getByRole('button', { name: /Preparar/ }).click();
  await expect(page.getByText('Estado actualizado')).toBeVisible();
  await expect(panel.getByRole('button', { name: /Despachar/ })).toBeVisible();

  // Despachar -> aparece "Marcar entregado".
  await panel.getByRole('button', { name: /Despachar/ }).click();
  await expect(panel.getByRole('button', { name: /Marcar entregado/ })).toBeVisible();

  // Entregar -> aparece "Registrar devolucion".
  await panel.getByRole('button', { name: /Marcar entregado/ }).click();
  const btnDev = panel.getByRole('button', { name: /Registrar devolución/ });
  await expect(btnDev).toBeVisible();

  // Devolver 1 unidad de la primera linea con pendiente.
  await btnDev.click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('spinbutton').first().fill('1');
  await dialog.locator('textarea').fill('Devolucion de prueba F7');
  await dialog.getByRole('button', { name: 'Registrar devolución' }).click();

  await expect(page.getByText(/Devolución registrada · reintegradas 1 unidad/)).toBeVisible();
});

test('admin: verificar consistencia del kardex (0 inconsistencias)', async ({ page }) => {
  await entrar(page, 'admin@shopcart.local', 'Admin123!');
  await page.goto('/admin/inventario');

  await page.getByRole('button', { name: /Verificar consistencia/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText(/Existencia = Σ kardex en todas las variantes/)).toBeVisible();
});

test('cliente: no puede entrar a /admin/inventario (403)', async ({ page }) => {
  await entrar(page, 'cliente@shopcart.local', 'Cliente123!');
  await page.goto('/admin/inventario');
  await expect(page).toHaveURL(/\/403$/);
});
