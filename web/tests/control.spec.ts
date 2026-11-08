import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * Ejecuta un script .sql de db/scripts/pruebas contra ShopCart (mismo sqlcmd que el
 * instalador). El SQL vive en el .sql, nunca en TypeScript: aqui solo se pasa la ruta.
 */
function ejecutarScript(rutaRelativa: string) {
  const archivo = fileURLToPath(new URL(`../../${rutaRelativa}`, import.meta.url));
  execFileSync('sqlcmd', ['-S', 'localhost', '-E', '-C', '-b', '-d', 'ShopCart', '-i', archivo], {
    stdio: 'ignore',
  });
}

/**
 * F8 - Area interna de control (Cupones, Bitacora, Usuarios). Asume API en :3000, Vite en
 * :5173 y la BD recien instalada. 1 worker (las escrituras mutan estado compartido).
 */
async function entrar(page: Page, correo: string, contrasena: string) {
  await page.goto('/login');
  await page.getByPlaceholder('tucorreo@ejemplo.com').fill(correo);
  await page.getByPlaceholder('Tu contraseña').fill(contrasena);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

function fecha(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

/* ------------------------------------------------------------------ C6 ---- */
test('cupones: crear un cupón general vigente aparece en la cinta de la tienda', async ({ page }) => {
  const codigo = `F8C${Date.now() % 100000}`;
  await entrar(page, 'admin@shopcart.local', 'Admin123!');
  await page.goto('/admin/cupones');
  await expect(page.getByRole('heading', { name: 'Cupones', level: 1 })).toBeVisible();

  await page.getByRole('button', { name: 'Nuevo cupón' }).click();
  const panel = page.getByTestId('panel-cupon');
  await panel.getByLabel('Código').fill(codigo);
  await panel.getByRole('spinbutton').first().fill('12'); // Valor (PORCENTAJE por defecto)
  const dias = panel.locator('input[type="date"]');
  await dias.nth(0).fill(fecha(-1)); // Desde (ayer: ya vigente)
  await dias.nth(1).fill(fecha(2)); // Hasta (en 2 dias: la FechaFin mas proxima entre los generales)
  await panel.getByRole('button', { name: 'Crear cupón' }).click();

  await expect(page.getByText('Cupón guardado')).toBeVisible();

  // Reabrir: el cupón aparece en la tabla con estado Vigente.
  await page.getByPlaceholder('Buscar por código…').fill(codigo);
  const fila = page.locator('tbody tr').filter({ hasText: codigo });
  await expect(fila).toHaveCount(1);
  await expect(fila.getByText('Vigente')).toBeVisible();

  // Efecto en la tienda: la cinta superior lee GET /cupones/vigentes y muestra el cupón general
  // con la FechaFin mas proxima (el recién creado). En una BD recién instalada es exactamente
  // este; el patrón F8C lo hace robusto si la suite se repite sin reinstalar.
  await page.goto('/');
  await expect(page.getByText(/F8C\d+/).first()).toBeVisible();
});

/* ------------------------------------------------------------------ D5 ---- */
test('bitácora: cambiar el precio de una variante registra un UPDATE de Variante', async ({ page }) => {
  // Precio único por corrida: garantiza un cambio real (y por tanto un evento MODIFICAR en la
  // bitácora) aunque la suite se repita sin reinstalar la BD.
  const precio = (150 + (Date.now() % 5000) / 100).toFixed(2);
  await entrar(page, 'admin@shopcart.local', 'Admin123!');
  await page.goto('/admin/productos');
  await expect(page.getByRole('heading', { name: 'Productos', level: 1 })).toBeVisible();

  // Editar el primer producto y cambiar el precio de su primera variante.
  await page.locator('tbody tr').first().getByRole('button', { name: 'Editar' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /Variantes/ }).click();
  const inputPrecio = dialog.getByRole('spinbutton').first();
  await inputPrecio.fill(precio);
  await dialog.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Cambios guardados')).toBeVisible();

  // En Bitácora aparece el UPDATE de Variante con el precio nuevo resaltado.
  await page.goto('/admin/bitacora');
  await expect(page.getByRole('heading', { name: 'Bitácora', level: 1 })).toBeVisible();
  await page.getByPlaceholder('Buscar en los cambios…').fill(precio);
  const fila = page.locator('tbody tr').filter({ hasText: 'Variante' }).filter({ hasText: precio });
  await expect(fila.first()).toBeVisible();
  await expect(fila.first().getByText(/Precio/)).toBeVisible();
  await expect(fila.first().getByText('MODIFICAR')).toBeVisible();
});

/* ------------------------------------------------------------------ E6 ---- */
test('usuarios: crear operador, iniciar con la clave temporal y cambiar la contraseña', async ({ page }) => {
  const correo = `op.f8.${Date.now() % 1000000}@shopcart.local`;
  await entrar(page, 'admin@shopcart.local', 'Admin123!');
  await page.goto('/admin/usuarios');
  await expect(page.getByRole('heading', { name: 'Usuarios', level: 1 })).toBeVisible();

  await page.getByRole('button', { name: 'Nuevo usuario interno' }).click();
  const panel = page.getByTestId('panel-nuevo-usuario');
  await panel.getByLabel('Nombre').fill('Operador F8');
  await panel.getByLabel('Correo').fill(correo);
  await panel.getByRole('button', { name: 'Crear usuario' }).click();

  const temporal = (await page.getByTestId('contrasena-temporal').textContent())?.trim() ?? '';
  expect(temporal.length).toBeGreaterThanOrEqual(12);
  await page.getByRole('button', { name: 'Listo' }).click();

  // Cerrar sesión del admin e iniciar con la clave temporal del operador nuevo.
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await entrar(page, correo, temporal);

  // Con la clave temporal (DebeCambiarContrasena), el login lleva a Seguridad y el área interna
  // queda bloqueada: ir a /admin redirige de vuelta a Mi cuenta hasta cambiarla (D13).
  await expect(page).toHaveURL(/\/cuenta/);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/cuenta/);

  // Cambiar la contraseña (los usuarios internos solo ven Datos y Seguridad).
  await page.goto('/cuenta');
  await page.getByLabel('Contraseña actual').fill(temporal);
  await page.getByLabel('Contraseña nueva').fill('ClaveNueva123');
  await page.getByLabel('Confirmar contraseña').fill('ClaveNueva123');
  await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
  await expect(page.getByText(/Contraseña actualizada/)).toBeVisible();

  // El cambio cierra la sesión (lleva al inicio); al re-entrar con la clave nueva ya NO está
  // bloqueado -> /admin. toHaveURL (no waitForURL) para no esperar un "load" que la navegación
  // SPA con replace no dispara.
  await expect(page).toHaveURL(/:5173\/$/, { timeout: 15_000 });
  await entrar(page, correo, 'ClaveNueva123');
  await expect(page).toHaveURL(/\/admin$/);
});

test('usuarios: una cuenta bloqueada se desbloquea y el cliente vuelve a iniciar sesión', async ({ page }) => {
  const correo = 'cliente2@shopcart.local';

  // Se simula la cuenta bloqueada fijando BloqueadoHasta (lock de BD por IntentosFallidos). El
  // login real no llega a ese lock desde una sola IP: auth.service la frena antes (throttle por
  // IP = 5). Lo que se prueba aqui es el ciclo UI: ver "Bloqueado" → Desbloquear → iniciar sesion.
  // El UPDATE vive en el script .sql, ejecutado con sqlcmd (-i); no hay SQL en TypeScript.
  ejecutarScript('db/scripts/pruebas/bloquear_usuario.sql');

  await entrar(page, 'admin@shopcart.local', 'Admin123!');
  await page.goto('/admin/usuarios');
  await page.getByPlaceholder('Buscar por nombre o correo…').fill('cliente2');
  const fila = page.locator('tbody tr').filter({ hasText: correo });
  await expect(fila).toHaveCount(1);
  await expect(fila.getByText(/Bloqueado/)).toBeVisible();

  await fila.getByRole('button', { name: 'Desbloquear' }).click();
  await expect(page.getByText('Cuenta desbloqueada')).toBeVisible();

  // El cliente ya puede iniciar sesión (aterriza en la tienda).
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await entrar(page, correo, 'Cliente123!');
  await expect(page).toHaveURL((u) => !u.pathname.startsWith('/login'));
});

/* --------------------------- Sin scroll horizontal ------------------------ */
const RUTAS: { ruta: string; titulo: string }[] = [
  { ruta: '/admin/productos', titulo: 'Productos' },
  { ruta: '/admin/categorias', titulo: 'Categorías' },
  { ruta: '/admin/inventario', titulo: 'Inventario' },
  { ruta: '/admin/pedidos', titulo: 'Pedidos' },
  { ruta: '/admin/cupones', titulo: 'Cupones' },
  { ruta: '/admin/bitacora', titulo: 'Bitácora' },
  { ruta: '/admin/usuarios', titulo: 'Usuarios' },
];

test('área interna: tablas a todo el ancho sin scroll horizontal (1280 y 390)', async ({ page }) => {
  // Una sola carga por ruta (cada page.goto recarga y renueva sesión); los dos anchos se
  // comprueban redimensionando en caliente, sin recargar, para no saturar el límite de auth.
  await entrar(page, 'admin@shopcart.local', 'Admin123!');
  for (const { ruta, titulo } of RUTAS) {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(ruta);
    await expect(page.getByRole('heading', { name: titulo, level: 1 })).toBeVisible();
    for (const ancho of [1280, 390]) {
      await page.setViewportSize({ width: ancho, height: 900 });
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), {
          timeout: 5000,
        })
        .toBeLessThanOrEqual(1);
    }
  }
});
