import { test, expect, type Page } from '@playwright/test';
import zlib from 'node:zlib';

/**
 * REQUIERE SEMILLAS FRESCAS (no idempotente): edita precio/atributos/imagenes de productos y
 * variantes sembrados y deja alguna variante en 0; varias aserciones dependen del estado
 * inicial de las semillas. Corre bajo `npm run test:e2e` (que reinstala antes).
 */

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

test('admin: variante NUEVA con imagen — se guarda, se reabre, stock y la tienda la muestra', async ({ page, browser }) => {
  await entrar(page, 'admin@shopcart.local', 'Admin123!');
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto('/admin/productos');

  // Producto con varias variantes (Ambientador). Capturar su IDProducto del enlace "Inventario".
  await page.getByPlaceholder('Buscar por nombre o SKU…').fill('Ambientador');
  const fila = page.locator('tbody tr').filter({ hasText: 'Ambientador' }).first();
  await expect(fila).toBeVisible();
  const hrefInv = await fila.locator('a[href*="producto="]').first().getAttribute('href');
  const idProducto = Number(new URL(hrefInv!, 'http://x').searchParams.get('producto'));
  expect(idProducto).toBeGreaterThan(0);

  const sufijo = Date.now().toString().slice(-6);
  const sku = `ACC-AMB-NUEVA-${sufijo}`;
  const aroma = `AromaF7${sufijo}`;

  // Crear la variante nueva: SKU + precio + caracteristica unica + imagen subida desde la ficha.
  await fila.getByRole('button', { name: 'Editar' }).click();
  let panel = page.getByRole('dialog');
  await panel.getByRole('button', { name: /Variantes/ }).click();
  await panel.getByRole('button', { name: '+ Agregar variante' }).click();
  const ficha = panel.locator('div[data-sku]').last();
  await ficha.getByPlaceholder('SKU').fill(sku);
  await ficha.locator('input[type="number"]').fill('28.00');
  await ficha.getByPlaceholder('Característica (p. ej. Presentación, Color)').fill('Aroma');
  await ficha.getByPlaceholder('Opción (p. ej. 1 Galón, Rojo)').fill(aroma);
  await ficha.getByRole('button', { name: 'Agregar' }).click();
  await ficha.locator('input[type="file"]').setInputFiles({
    name: 'oceano.png',
    mimeType: 'image/png',
    buffer: pngSolido(64, 20, 90, 180),
  });
  await expect(ficha.locator('img')).toHaveAttribute('src', /\/uploads\/img\//, { timeout: 15000 });
  await panel.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(panel).toBeHidden();

  // Reabrir: la variante nueva conserva su imagen propia (persistio en la BD).
  await fila.getByRole('button', { name: 'Editar' }).click();
  panel = page.getByRole('dialog');
  await panel.getByRole('button', { name: /Variantes/ }).click();
  const fichaReabierta = panel.locator(`div[data-sku="${sku}"]`);
  await expect(fichaReabierta.locator('img')).toHaveAttribute('src', /\/uploads\/img\//, { timeout: 15000 });
  await panel.getByRole('button', { name: 'Cancelar' }).click();
  await expect(panel).toBeHidden();

  // Inventario con deep link ?producto=: el chip acota a las variantes del producto.
  await page.goto(`/admin/inventario?producto=${idProducto}`);
  await expect(page.getByRole('button', { name: /Producto:/ })).toBeVisible();
  const filaInv = page.locator('tbody tr').filter({ hasText: sku });
  await expect(filaInv).toHaveCount(1);

  // Registrar una entrada de +3 a la variante nueva desde el panel deslizante.
  await filaInv.getByRole('button', { name: 'Entrada' }).click();
  const panelInv = page.getByTestId('panel-inventario');
  await panelInv.locator('textarea').fill('Alta inicial variante F7');
  await panelInv.getByRole('button', { name: 'Entrada de compra' }).click();
  await panelInv.getByRole('spinbutton').fill('3');
  const btnEntrada = panelInv.getByRole('button', { name: 'Registrar entrada' });
  await expect(btnEntrada).toBeEnabled();
  await btnEntrada.click();
  await expect(page.getByText('Entrada registrada')).toBeVisible();

  // Tienda (sin sesion): al elegir la variante nueva, la imagen principal es la suya (/uploads/img/)
  // y el stock que viene de la API es "Quedan 3 unidades".
  const ctx = await browser.newContext();
  const tienda = await ctx.newPage();
  await tienda.goto(`/producto/${idProducto}`);
  await tienda.getByRole('button', { name: new RegExp(aroma) }).click();
  await expect(tienda.locator('img.anim-imagen')).toHaveAttribute('src', /\/uploads\/img\//);
  await expect(tienda.getByText('Quedan 3 unidades')).toBeVisible();
  await ctx.close();
});

test('admin: el badge de Inventario sube al dejar una variante en 0 (sin recargar)', async ({ page }) => {
  await entrar(page, 'admin@shopcart.local', 'Admin123!');
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto('/admin/inventario');
  await expect(page.getByRole('heading', { name: 'Inventario', level: 1 })).toBeVisible();
  // Esperar a que el resumen (subtitulo) y la tabla carguen antes de leer el badge/filas.
  await expect(page.getByText(/variantes ·/)).toBeVisible();
  await expect(page.locator('tbody tr').first()).toBeVisible();

  const leerBadge = async () => {
    const b = page.getByTestId('badge-inventario');
    if ((await b.count()) === 0 || !(await b.isVisible())) return 0;
    return Number(((await b.textContent()) ?? '0').trim());
  };
  const antes = await leerBadge();

  // Buscar una fila "sana" (Disponible pintado como numero verde, sin "· bajo" ni "· agotada")
  // con existencia > umbral: dejarla en 0 la convierte en agotada y sube el badge en 1.
  const filas = page.locator('tbody tr');
  const total = await filas.count();
  let objetivo = null as ReturnType<typeof filas.nth> | null;
  let disponible = 0;
  for (let i = 0; i < total; i++) {
    const celda = filas.nth(i).locator('td').nth(3);
    const txt = ((await celda.textContent()) ?? '').trim();
    if (/^\d+$/.test(txt) && Number(txt) > 5) {
      objetivo = filas.nth(i);
      disponible = Number(txt);
      break;
    }
  }
  expect(objetivo, 'debe existir una variante sana con existencia > 5').not.toBeNull();

  await objetivo!.getByRole('button', { name: 'Ajuste' }).click();
  const panel = page.getByTestId('panel-inventario');
  await panel.locator('textarea').fill('Ajuste a cero (prueba badge F7)');
  await panel.getByRole('button', { name: /Ajuste −/ }).click();
  await panel.getByRole('spinbutton').fill(String(disponible));
  const btn = panel.getByRole('button', { name: 'Registrar ajuste' });
  await expect(btn).toBeEnabled();
  await btn.click();
  await expect(page.getByText('Ajuste registrado')).toBeVisible();

  // El badge del menu sube en 1 sin recargar la pagina (invalidacion del resumen).
  await expect.poll(leerBadge, { timeout: 10000 }).toBe(antes + 1);
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
