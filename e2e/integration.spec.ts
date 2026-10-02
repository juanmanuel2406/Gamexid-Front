import { test, expect } from '@playwright/test';
test('GC-API sin credenciales no realiza consultas ni muestra conexión ficticia', async ({ page }) => {
  await page.route('**/api/access/me', r => r.fulfill({json: {id: 1, fullName: 'Demostración', role: 'Administrator'}}));
  await page.route('**/api/access/health', r => r.fulfill({json: {status: 'ok'}}));
  await page.route('**/api/access/integrations', r => r.fulfill({json: {gemini: false}}));
  await page.route('**/api/access/gc/status', r => r.fulfill({json: {configured: false, connected: false}}));
  await page.goto('/integracion');
  await expect(page.getByRole('heading', {name: 'Faltan credenciales de GamingCity'})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Consultar catálogo'})).toBeDisabled();
  await page.screenshot({path: 'test-results/integration-current.png', fullPage: true});
});
test('GC-API consulta protegida conserva error sin bloquear la interfaz', async ({ page }) => {
  await page.route('**/api/access/me', r => r.fulfill({json: {id: 1, fullName: 'Demostración', role: 'Administrator'}}));
  await page.route('**/api/access/health', r => r.fulfill({json: {status: 'ok'}}));
  await page.route('**/api/access/integrations', r => r.fulfill({json: {gemini: false}}));
  await page.route('**/api/access/gc/status', r => r.fulfill({json: {configured: true, connected: false}}));
  await page.route('**/api/access/gc/products?*', r => r.fulfill({status: 502, json: {mensaje: 'GC-API no disponible'}}));
  await page.goto('/integracion');
  await page.getByPlaceholder('EAN o nombre del producto').fill('7790000000011');
  await page.getByRole('button', {name: 'Consultar catálogo'}).click();
  await expect(page.getByRole('alert')).toHaveText('GC-API no disponible');
  await expect(page.getByRole('button', {name: 'Consultar catálogo'})).toBeEnabled();
});
