import { test, expect } from '@playwright/test';

/**
 * F6 - Mi cuenta: el cliente entra a /cuenta, cambia su telefono en "Datos personales",
 * guarda, recarga y el valor persiste (PUT /usuarios/me lo guardo en la BD).
 * Asume API en :3000 y Vite en :5173 corriendo, y la BD recien instalada.
 */
test('mi cuenta: cambiar el telefono persiste tras recargar', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('tucorreo@ejemplo.com').fill('cliente@shopcart.local');
  await page.getByPlaceholder('Tu contraseña').fill('Cliente123!');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByRole('banner').getByRole('button', { name: 'Menú de usuario' })).toBeVisible();

  await page.goto('/cuenta');
  await expect(page.getByRole('heading', { name: 'Datos personales' })).toBeVisible();

  const telefono = page.getByLabel('Teléfono');
  const nuevo = '5555-9090';
  await telefono.fill(nuevo);
  await page.getByRole('button', { name: 'Guardar cambios' }).click();

  // Tras recargar, el perfil viene de la API con el telefono nuevo.
  await page.reload();
  await expect(page.getByLabel('Teléfono')).toHaveValue(nuevo);
});
