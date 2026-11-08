import { test, expect, type Page } from '@playwright/test';

/**
 * Cierre C1.1 — ordenamiento del lado del servidor (RF, admin) y RF-03 (un ajuste exige
 * motivo). Asume API en :3000, Vite en :5173 y la BD recien instalada. Ninguna de estas
 * pruebas muta estado (solo lee listados y valida la deshabilitacion del boton), por lo que
 * es segura dentro de `npm run test:e2e`.
 */
async function entrar(page: Page, correo: string, contrasena: string) {
  await page.goto('/login');
  await page.getByPlaceholder('tucorreo@ejemplo.com').fill(correo);
  await page.getByPlaceholder('Tu contraseña').fill(contrasena);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

/** Convierte el texto de la celda "Precio desde" ("Q95.00") a numero; "—" -> null. */
function aPrecio(texto: string): number | null {
  const limpio = texto.replace(/[^\d.]/g, '');
  return limpio === '' ? null : Number(limpio);
}

test('admin: productos ordenados por precio desc — la primera fila trae el precio maximo', async ({ page }) => {
  await entrar(page, 'admin@shopcart.local', 'Admin123!');

  // El orden viaja en la URL (?orden=&direccion=) para sobrevivir a recargas.
  await page.goto('/admin/productos?orden=precio&direccion=DESC');
  await expect(page.getByRole('heading', { name: 'Productos', level: 1 })).toBeVisible();

  // La cabecera "Precio desde" refleja la direccion con aria-sort.
  const th = page.locator('th', { hasText: 'Precio desde' });
  await expect(th).toHaveAttribute('aria-sort', 'descending');

  // Celdas de la 4.ª columna (Producto, Categoría, Variantes, Precio desde, …).
  const celdas = page.locator('tbody tr td:nth-child(4)');
  await expect(celdas.first()).toBeVisible();

  const precios = (await celdas.allTextContents())
    .map(aPrecio)
    .filter((n): n is number => n !== null);

  expect(precios.length).toBeGreaterThan(1);
  // La primera fila es el maximo (lo que devuelve el SP ordenado desc) y la pagina viene
  // monotonamente decreciente.
  expect(precios[0]).toBe(Math.max(...precios));
  for (let i = 1; i < precios.length; i++) {
    expect(precios[i - 1]).toBeGreaterThanOrEqual(precios[i]!);
  }

  // Al invertir la direccion, la primera fila deja de ser el maximo (orden ascendente).
  await page.goto('/admin/productos?orden=precio&direccion=ASC');
  await expect(page.locator('th', { hasText: 'Precio desde' })).toHaveAttribute('aria-sort', 'ascending');
  const preciosAsc = (await page.locator('tbody tr td:nth-child(4)').allTextContents())
    .map(aPrecio)
    .filter((n): n is number => n !== null);
  expect(preciosAsc[0]).toBe(Math.min(...preciosAsc));
});

test('operador: un ajuste sin motivo deja el boton deshabilitado y muestra el mensaje (RF-03)', async ({ page }) => {
  await entrar(page, 'operador@shopcart.local', 'Operador123!');

  await page.goto('/admin/inventario');
  await page.getByPlaceholder('Buscar por SKU o producto…').fill('ACC-FIL-UNIV-STD');
  const fila = page.locator('tbody tr').filter({ hasText: 'ACC-FIL-UNIV-STD' });
  await expect(fila).toHaveCount(1);
  // El boton "Ajuste" abre el panel con tipo AJUSTE_POSITIVO.
  await fila.getByRole('button', { name: 'Ajuste' }).click();

  const panel = page.getByTestId('panel-inventario');
  await expect(panel.getByText('Registrar movimiento')).toBeVisible();

  // Cantidad valida, motivo vacio: el ajuste exige motivo (RF-03).
  await panel.getByRole('spinbutton').fill('1');
  await expect(panel.getByTestId('motivo-error')).toHaveText('El motivo es obligatorio para un ajuste');
  await expect(panel.getByRole('button', { name: 'Registrar ajuste' })).toBeDisabled();

  // Al escribir un motivo valido (>= 3), el mensaje desaparece.
  await panel.locator('textarea').fill('Conteo fisico');
  await expect(panel.getByTestId('motivo-error')).toHaveCount(0);
});
