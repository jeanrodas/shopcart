import { test, expect, type Page } from '@playwright/test';

/**
 * F6 - Area interna. Asume API en :3000 y Vite en :5173 corriendo y la BD recien instalada.
 */
async function entrar(page: Page, correo: string, contrasena: string) {
  await page.goto('/login');
  await page.getByPlaceholder('tucorreo@ejemplo.com').fill(correo);
  await page.getByPlaceholder('Tu contraseña').fill(contrasena);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

test('admin: productos con pills de estado y edicion de precio de variante', async ({ page }) => {
  await entrar(page, 'admin@shopcart.local', 'Admin123!');
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto('/admin/productos');
  await expect(page.getByRole('heading', { name: 'Productos', level: 1 })).toBeVisible();
  // La tabla trae pills de estado derivado.
  await expect(page.getByText('Publicado', { exact: true }).first()).toBeVisible();

  // Aislar por SKU exacto un producto de una sola variante (evita coincidir con "Motor").
  await page.getByPlaceholder('Buscar por nombre o SKU…').fill('LUB-MOT-20W50-1QT');
  const fila = page.locator('tbody tr').filter({ hasText: 'Aceite para Moto' });
  await expect(fila).toHaveCount(1);
  await expect(page.locator('tbody tr')).toHaveCount(1);

  // Abrir el panel DE ESA fila y cambiar el precio de la variante.
  await fila.getByRole('button', { name: 'Editar' }).click();
  const panel = page.getByRole('dialog');
  await expect(panel).toBeVisible();
  await panel.getByRole('button', { name: /Variantes/ }).click();
  const precio = panel.getByRole('spinbutton').first();
  await precio.fill('77.77');
  await expect(precio).toHaveValue('77.77');
  await panel.getByRole('button', { name: 'Guardar cambios' }).click();

  // Tras guardar, la fila de "Aceite para Moto" refleja el nuevo "precio desde".
  await expect(panel).toBeHidden();
  await expect(fila.getByText('Q 77.77')).toBeVisible();
});

test('operador: sin "Nuevo producto" y el panel es de solo lectura', async ({ page }) => {
  await entrar(page, 'operador@shopcart.local', 'Operador123!');
  await expect(page).toHaveURL(/\/admin$/);

  await page.goto('/admin/productos');
  await expect(page.getByRole('heading', { name: 'Productos', level: 1 })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nuevo producto' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Editar' }).first().click();
  const panel = page.getByRole('dialog');
  await expect(panel).toBeVisible();
  await expect(panel.getByText('Solo lectura')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Guardar cambios' })).toHaveCount(0);
});

test('admin: atributo y precio de variante persisten tras guardar y reabrir', async ({ page }) => {
  await entrar(page, 'admin@shopcart.local', 'Admin123!');
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto('/admin/productos');
  await page.getByPlaceholder('Buscar por nombre o SKU…').fill('ADI-REF-AZUL-1GAL');
  const fila = page.locator('tbody tr').filter({ hasText: 'Refrigerante de Motor' });
  await expect(fila).toHaveCount(1);

  // Abrir el panel y localizar la ficha de la variante AZUL.
  await fila.getByRole('button', { name: 'Editar' }).click();
  let panel = page.getByRole('dialog');
  await panel.getByRole('button', { name: /Variantes/ }).click();
  let ficha = panel.locator('[data-sku="ADI-REF-AZUL-1GAL"]');
  await expect(ficha).toBeVisible();

  // Agregar caracteristica Tipo = Azul y cambiar el precio a 109.50.
  await ficha.getByPlaceholder('Característica (p. ej. Presentación, Color)').fill('Tipo');
  await ficha.getByPlaceholder('Opción (p. ej. 1 Galón, Rojo)').fill('Azul');
  await ficha.getByRole('button', { name: 'Agregar' }).click();
  await expect(ficha.getByText('Tipo')).toBeVisible();
  const precio = ficha.locator('input[type="number"]');
  await precio.fill('109.50');
  await expect(precio).toHaveValue('109.50');
  await panel.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(panel).toBeHidden();

  // Reabrir: el atributo y el precio persisten.
  await fila.getByRole('button', { name: 'Editar' }).click();
  panel = page.getByRole('dialog');
  await panel.getByRole('button', { name: /Variantes/ }).click();
  ficha = panel.locator('[data-sku="ADI-REF-AZUL-1GAL"]');
  await expect(ficha.getByText('Tipo')).toBeVisible();
  await expect(ficha.getByText('Azul')).toBeVisible();
  await expect(ficha.locator('input[type="number"]')).toHaveValue('109.5');
});

test('admin: caracteristica pendiente sin pulsar Agregar se guarda al Guardar', async ({ page }) => {
  await entrar(page, 'admin@shopcart.local', 'Admin123!');
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto('/admin/productos');
  await page.getByPlaceholder('Buscar por nombre o SKU…').fill('ADI-REF-ROJO-1GAL');
  const fila = page.locator('tbody tr').filter({ hasText: 'Refrigerante de Motor' });
  await expect(fila).toHaveCount(1);

  await fila.getByRole('button', { name: 'Editar' }).click();
  let panel = page.getByRole('dialog');
  await panel.getByRole('button', { name: /Variantes/ }).click();
  let ficha = panel.locator('[data-sku="ADI-REF-ROJO-1GAL"]');
  await expect(ficha).toBeVisible();

  // Escribir Color / Azul SIN pulsar "Agregar" y guardar: debe agregarse automaticamente.
  await ficha.getByPlaceholder('Característica (p. ej. Presentación, Color)').fill('Color');
  await ficha.getByPlaceholder('Opción (p. ej. 1 Galón, Rojo)').fill('Azul');
  await panel.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(panel).toBeHidden();

  // Reabrir: "Color · Azul" persiste como caracteristica.
  await fila.getByRole('button', { name: 'Editar' }).click();
  panel = page.getByRole('dialog');
  await panel.getByRole('button', { name: /Variantes/ }).click();
  ficha = panel.locator('[data-sku="ADI-REF-ROJO-1GAL"]');
  await expect(ficha.getByText('Color', { exact: true })).toBeVisible();
  await expect(ficha.getByText('Azul', { exact: true })).toBeVisible();
});

test('movil 390x844: /admin/productos sin scroll horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await entrar(page, 'admin@shopcart.local', 'Admin123!');
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto('/admin/productos');

  const primera = page.locator('article').first();
  await expect(primera).toBeVisible();
  // Sin scroll horizontal del documento.
  const sinScroll = await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
  expect(sinScroll).toBe(true);
  // La primera tarjeta muestra nombre y un pill de estado.
  await expect(primera.getByText(/Publicado|Agotado|Incompleto|Oculto/).first()).toBeVisible();
});

test('cliente: /admin devuelve la pagina 403', async ({ page }) => {
  await entrar(page, 'cliente@shopcart.local', 'Cliente123!');
  // Esperar a que la sesion quede establecida antes de navegar (recarga completa).
  await expect(page.getByRole('banner').getByRole('button', { name: 'Menú de usuario' })).toBeVisible();
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/403$/);
  await expect(page.getByRole('heading', { name: 'No tienes acceso a esta página' })).toBeVisible();
});
