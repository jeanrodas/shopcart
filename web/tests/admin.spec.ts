import { test, expect, type Page } from '@playwright/test';
import zlib from 'node:zlib';

/** Genera en memoria un PNG solido NxN (sin binarios externos) para la subida de imagen. */
function pngSolido(n: number, r: number, g: number, b: number): Buffer {
  const crc32 = (buf: Buffer) => {
    let c = ~0;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i]!;
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return (~c) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const t = Buffer.from(type, 'ascii');
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, crc]);
  };
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(n, 0);
  ihdr.writeUInt32BE(n, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  const row = Buffer.alloc(1 + n * 3);
  for (let x = 0; x < n; x++) {
    row[1 + x * 3] = r;
    row[2 + x * 3] = g;
    row[3 + x * 3] = b;
  }
  const raw = Buffer.concat(Array.from({ length: n }, () => row));
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

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
  // El cargador de imagen de variante no muestra controles para el operador.
  await panel.getByRole('button', { name: /Variantes/ }).click();
  await expect(panel.getByRole('button', { name: 'Subir' })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Cambiar' })).toHaveCount(0);
});

test('admin: imagen por variante — subir, guardar, y la tienda la muestra', async ({ page, browser }) => {
  await entrar(page, 'admin@shopcart.local', 'Admin123!');
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto('/admin/productos');
  await page.getByPlaceholder('Buscar por nombre o SKU…').fill('ADI-REF-ROJO-1GAL');
  const fila = page.locator('tbody tr').filter({ hasText: 'Refrigerante de Motor' });
  await expect(fila).toHaveCount(1);
  const hrefInv = await fila.locator('a[href*="producto="]').first().getAttribute('href');
  const idProducto = Number(new URL(hrefInv!, 'http://x').searchParams.get('producto'));
  expect(idProducto).toBeGreaterThan(0);

  // Subir una imagen a la variante ROJO.
  await fila.getByRole('button', { name: 'Editar' }).click();
  let panel = page.getByRole('dialog');
  await panel.getByRole('button', { name: /Variantes/ }).click();
  let ficha = panel.locator('[data-sku="ADI-REF-ROJO-1GAL"]');
  await expect(ficha).toBeVisible();
  await ficha.locator('input[type="file"]').setInputFiles({
    name: 'rojo.png',
    mimeType: 'image/png',
    buffer: pngSolido(64, 220, 38, 38),
  });
  // Tras subir, el cargador muestra la imagen (/uploads/img/…).
  await expect(ficha.locator('img')).toHaveAttribute('src', /\/uploads\/img\//, { timeout: 15000 });
  await panel.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(panel).toBeHidden();

  // Reabrir: la ficha conserva la imagen.
  await fila.getByRole('button', { name: 'Editar' }).click();
  panel = page.getByRole('dialog');
  await panel.getByRole('button', { name: /Variantes/ }).click();
  ficha = panel.locator('[data-sku="ADI-REF-ROJO-1GAL"]');
  await expect(ficha.locator('img')).toHaveAttribute('src', /\/uploads\/img\//, { timeout: 15000 });

  // Tienda (sin sesion): al elegir ROJO la imagen principal es la de la variante; VERDE vuelve a la del producto.
  const ctx = await browser.newContext();
  const tienda = await ctx.newPage();
  await tienda.goto(`/producto/${idProducto}`);
  await expect(tienda.getByRole('heading', { name: 'Refrigerante de Motor' })).toBeVisible();
  await tienda.getByRole('button', { name: /Rojo/ }).click();
  await expect(tienda.locator('img.anim-imagen')).toHaveAttribute('src', /\/uploads\/img\//);
  await tienda.getByRole('button', { name: /Verde/ }).click();
  await expect(tienda.locator('img.anim-imagen')).not.toHaveAttribute('src', /\/uploads\/img\//);
  await ctx.close();
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
