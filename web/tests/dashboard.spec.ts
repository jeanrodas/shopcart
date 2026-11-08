import { test, expect, request, type APIRequestContext, type Page } from '@playwright/test';

const API = 'http://localhost:3000';

async function entrar(page: Page, correo: string, contrasena: string) {
  await page.goto('/login');
  await page.getByPlaceholder('tucorreo@ejemplo.com').fill(correo);
  await page.getByPlaceholder('Tu contraseña').fill(contrasena);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

/**
 * Completa una compra como cliente a traves de la API (no SQL en TS; la prueba prepara
 * datos usando la propia API, como permite la consigna). Dispara el evento pedido.creado.
 */
async function comprarComoCliente(api: APIRequestContext): Promise<string> {
  const login = await api.post('/api/v1/auth/login', {
    data: { correo: 'cliente2@shopcart.local', contrasena: 'Cliente123!' },
  });
  const token = (await login.json()).accessToken as string;
  const h = { Authorization: `Bearer ${token}` };

  await api.delete('/api/v1/carrito', { headers: h });

  let idDireccion: number | undefined;
  const dir = await api.get('/api/v1/direcciones', { headers: h });
  const lista = (await dir.json()) as Array<{ id?: number; IDDireccion?: number }>;
  idDireccion = lista[0]?.id ?? lista[0]?.IDDireccion;
  if (!idDireccion) {
    const creada = await api.post('/api/v1/direcciones', {
      headers: h,
      data: {
        alias: 'Casa', nombreReceptor: 'Cliente Dos', telefono: '55555555',
        linea1: 'Zona 1 Ciudad', municipio: 'Guatemala', departamento: 'Guatemala',
      },
    });
    const c = (await creada.json()) as { id?: number; IDDireccion?: number };
    idDireccion = c.id ?? c.IDDireccion;
  }

  // Variante de alto stock (producto distinto a /producto/1) para no competir por el stock
  // con las pruebas de UI (compra.spec y sesion.spec usan el producto 1).
  await api.post('/api/v1/carrito/items', { headers: h, data: { idVariante: 3, cantidad: 1 } });
  await api.post('/api/v1/checkout/iniciar', { headers: h, data: { idDireccion } });
  const clave = `pw-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const pago = await api.post('/api/v1/checkout/pagar', {
    headers: { ...h, 'Idempotency-Key': clave },
    data: { idDireccion, metodoPago: 'EFECTIVO', simularResultado: 'APROBADO' },
  });
  expect(pago.status(), 'el pago del cliente debe aprobarse (201)').toBe(201);
  return ((await pago.json()).pedido?.NumeroPedido as string) ?? '';
}

test('dashboard: KPIs y gráficas, chip en vivo, evento al comprar, cambio de periodo y sin scroll', async ({
  page,
}) => {
  await entrar(page, 'admin@shopcart.local', 'Admin123!');
  await page.goto('/admin');

  // KPIs y graficas.
  await expect(page.getByText('Ventas netas')).toBeVisible();
  await expect(page.getByText('Ticket promedio')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ventas por día' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Ventas por día' })).toBeVisible();

  // Chip "En vivo" conectado (el SSE se conecta tras pedir el ticket).
  const chip = page.getByTestId('chip-vivo');
  await expect(chip).toHaveAttribute('data-estado', 'conectado', { timeout: 15_000 });

  // Contador "Pagados por preparar" inicial (espera a que sea numerico).
  const contador = page.getByTestId('contador-pagados');
  await expect(contador).toHaveText(/^\d+$/, { timeout: 10_000 });
  const inicial = Number(await contador.innerText());

  // En otra sesion (contexto HTTP aparte), un cliente completa una compra.
  const api = await request.newContext({ baseURL: API });
  const numero = await comprarComoCliente(api);
  await api.dispose();

  // El evento pedido.creado llega al feed sin recargar.
  await expect(page.getByText(numero, { exact: false }).first()).toBeVisible({ timeout: 8_000 });

  // El contador "Pagados por preparar" sube (via invalidacion por evento), sin recargar.
  await expect
    .poll(async () => Number(await contador.innerText()), { timeout: 10_000 })
    .toBeGreaterThan(inicial);

  // Cambiar el periodo recalcula los KPIs (nueva consulta; el bloque sigue visible).
  await page.getByRole('button', { name: 'Hoy' }).click();
  await expect(page.getByRole('button', { name: 'Hoy' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Ventas netas')).toBeVisible();

  // Sin scroll horizontal de pagina a 1280 y 390 (el único scroll permitido es dentro del mapa de calor).
  for (const ancho of [1280, 390]) {
    await page.setViewportSize({ width: ancho, height: 900 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), { timeout: 5000 })
      .toBeLessThanOrEqual(1);
  }
});
