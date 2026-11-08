import { test, expect, request, type APIRequestContext, type Page } from '@playwright/test';

const API = 'http://localhost:3000';

async function entrar(page: Page, correo: string, contrasena: string) {
  await page.goto('/login');
  await page.getByPlaceholder('tucorreo@ejemplo.com').fill(correo);
  await page.getByPlaceholder('Tu contraseña').fill(contrasena);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await page.waitForURL((u) => !u.pathname.startsWith('/login'));
}

/** Crea un pedido PAGADO por API (idVariante 3, alto stock). Devuelve su número. */
async function comprarComoCliente(api: APIRequestContext): Promise<string> {
  const login = await api.post('/api/v1/auth/login', {
    data: { correo: 'cliente2@shopcart.local', contrasena: 'Cliente123!' },
  });
  const token = (await login.json()).accessToken as string;
  const h = { Authorization: `Bearer ${token}` };
  await api.delete('/api/v1/carrito', { headers: h });
  const dir = (await (await api.get('/api/v1/direcciones', { headers: h })).json()) as Array<{ id?: number; IDDireccion?: number }>;
  const idDireccion = dir[0]?.IDDireccion ?? dir[0]?.id;
  await api.post('/api/v1/carrito/items', { headers: h, data: { idVariante: 3, cantidad: 1 } });
  await api.post('/api/v1/checkout/iniciar', { headers: h, data: { idDireccion } });
  const pago = await api.post('/api/v1/checkout/pagar', {
    headers: { ...h, 'Idempotency-Key': `pv-${Date.now()}-${Math.random().toString(36).slice(2, 10)}` },
    data: { idDireccion, metodoPago: 'EFECTIVO', simularResultado: 'APROBADO' },
  });
  expect(pago.status(), 'el pago del cliente debe aprobarse (201)').toBe(201);
  return ((await pago.json()).pedido?.NumeroPedido as string) ?? '';
}

test('pedidos: un pedido nuevo sube la tarjeta Pagados y la tabla a la vez, sin recargar', async ({ page }) => {
  await entrar(page, 'admin@shopcart.local', 'Admin123!');
  await page.goto('/admin/pedidos');
  await expect(page.getByRole('heading', { name: 'Pedidos', level: 1 })).toBeVisible();

  // La suscripción SSE de la pantalla debe estar conectada antes de crear el pedido.
  await expect(page.getByTestId('sse-operacion')).toHaveAttribute('data-estado', 'conectado', { timeout: 15_000 });

  // Valor inicial de la tarjeta "Pagados". Se espera a que la tabla tenga al menos una fila
  // (la cola PAGADO nunca está vacía con semillas) para no leer un conteo prematuro.
  const tarjeta = page.getByTestId('tarjeta-PAGADO');
  await expect(tarjeta).toHaveText(/^\d+$/, { timeout: 10_000 });
  await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 10_000 });
  const inicial = Number(await tarjeta.innerText());

  // Crear un pedido por API (contexto aparte).
  const api = await request.newContext({ baseURL: API });
  const numero = await comprarComoCliente(api);
  await api.dispose();

  // Tarjeta (resumen) y tabla (listado) suben JUNTAS, sin recargar: la tarjeta pasa a inicial+1
  // y el nuevo número aparece PRIMERO en la tabla. (El total de filas visibles no se compara en
  // crudo: la cola acumula pedidos y la tabla pagina a 20, lo que haría frágil un delta exacto.)
  await expect.poll(async () => Number(await tarjeta.innerText()), { timeout: 12_000 }).toBe(inicial + 1);
  await expect(page.locator('tbody tr').first()).toContainText(numero, { timeout: 12_000 });
});
