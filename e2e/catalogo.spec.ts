import { test, expect } from '@playwright/test';
import { mockInventory } from './mock-api';
test.beforeEach(async ({ page }) => { await mockInventory(page); });
test('Catálogo sin credenciales no realiza consultas ni muestra conexión ficticia', async ({ page }) => {
  await page.route('**/api/access/me', r => r.fulfill({json: {id: 1, fullName: 'Demostración', role: 'Administrator'}}));
  await page.route('**/api/access/health', r => r.fulfill({json: {status: 'ok'}}));
  await page.route('**/api/access/integrations', r => r.fulfill({json: {pdfPig: true}}));
  await page.route('**/api/access/gc/status', r => r.fulfill({json: {configured: false, connected: false}}));
  await page.goto('/productos');
  await expect(page.getByRole('status').filter({hasText:'Catálogo no configurado'})).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('button', {name: 'Consultar catálogo'})).toBeDisabled();
  await page.screenshot({path: 'test-results/integration-current.png', fullPage: true});
});
test('Catálogo consulta protegida conserva error sin bloquear la interfaz', async ({ page }) => {
  await page.route('**/api/access/me', r => r.fulfill({json: {id: 1, fullName: 'Demostración', role: 'Administrator'}}));
  await page.route('**/api/access/health', r => r.fulfill({json: {status: 'ok'}}));
  await page.route('**/api/access/integrations', r => r.fulfill({json: {pdfPig: true}}));
  await page.route('**/api/access/gc/status', r => r.fulfill({json: {configured: true, connected: false}}));
  await page.route('**/api/access/gc/products?*', r => r.fulfill({status: 502, json: {mensaje: 'Catálogo no disponible'}}));
  await page.goto('/productos');
  await page.getByPlaceholder('Nombre o código del producto').fill('7790000000011');
  await page.getByRole('button', {name: 'Consultar catálogo'}).click();
  await expect(page.getByRole('alert')).toHaveText('Catálogo no disponible');
  await expect(page.getByRole('button', {name: 'Consultar catálogo'})).toBeEnabled();
});


test('Gaming City muestra productos y consulta puntual sin parámetros secretos', async ({ page }) => {
  await page.route('**/api/access/me', r => r.fulfill({json: {id: 1, fullName: 'QA', role: 'Administrator'}}));
  await page.route('**/api/access/gc/status', r => r.fulfill({json: {configured: true}}));
  const product = {id: '4715', name: 'RYZEN 5 3400G', code: '04715', supplierCode: '730143309837', sku: 'AMD-4715', price: 119999, stock: 0};
  await page.route('**/api/access/gc/products?*', r => {
    expect(r.request().url()).not.toContain('iue');
    return r.fulfill({json: {data: {products: [product], total: 1, truncated: false}}});
  });
  await page.route('**/api/access/gc/products/4715', r => r.fulfill({json: {data: product}}));
  await page.goto('/productos');
  await page.getByPlaceholder('Nombre o código del producto').fill('RYZEN 5 3400G');
  await page.getByRole('button', {name: 'Consultar catálogo'}).click();
  await expect(page.getByRole('status').filter({hasText:'Conectado'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'RYZEN 5 3400G', exact: true})).toBeVisible();
  await expect(page.getByText('730143309837', {exact: true})).toBeVisible();
  await page.getByPlaceholder('Ejemplo: 4715').fill('4715');
  await page.getByRole('button', {name: 'Consultar por ID'}).click();
  await expect(page.getByText('Stock proveedor · depósito 1')).toBeVisible();
});

test('Gaming City muestra una búsqueda vacía como resultado válido', async ({ page }) => {
  await page.route('**/api/access/me', r => r.fulfill({json: {id: 1, fullName: 'QA', role: 'Administrator'}}));
  await page.route('**/api/access/gc/status', r => r.fulfill({json: {configured: true}}));
  await page.route('**/api/access/gc/products?*', r => r.fulfill({json: {data: {products: [], total: 0, truncated: false}}}));
  await page.goto('/productos');
  await page.getByPlaceholder('Nombre o código del producto').fill('sin coincidencias');
  await page.getByRole('button', {name: 'Consultar catálogo'}).click();
  await expect(page.getByText('Sin resultados')).toBeVisible();
});
