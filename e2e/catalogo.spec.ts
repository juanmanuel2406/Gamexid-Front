import { test, expect } from '@playwright/test';
import { mockInventory } from './mock-api';
test.beforeEach(async ({ page }) => { await mockInventory(page); });
test('Catálogo sin credenciales no realiza consultas ni muestra conexión ficticia', async ({ page }) => {
  await page.route('**/api/access/me', r => r.fulfill({json: {id: 1, fullName: 'Demostración', role: 'Administrator'}}));
  await page.route('**/api/access/health', r => r.fulfill({json: {status: 'ok'}}));
  await page.route('**/api/access/integrations', r => r.fulfill({json: {pdfPig: true}}));
  await page.route('**/api/access/gc/status', r => r.fulfill({json: {configured: false, connected: false}}));
  await page.goto('/productos');
  await page.getByLabel('Sede de Gaming City').selectOption({ label: 'Depósito' });
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
  await page.getByLabel('Sede de Gaming City').selectOption({ label: 'Depósito' });
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
  await page.route('**/api/access/gc/products/4715?*', r => r.fulfill({json: {data: product}}));
  await page.goto('/productos');
  await page.getByLabel('Sede de Gaming City').selectOption({ label: 'Depósito' });
  await page.getByPlaceholder('Nombre o código del producto').fill('RYZEN 5 3400G');
  await page.getByRole('button', {name: 'Consultar catálogo'}).click();
  await expect(page.getByRole('status').filter({hasText:'Conectado'})).toBeVisible();
  await expect(page.getByRole('heading', {name: 'RYZEN 5 3400G', exact: true})).toBeVisible();
  await expect(page.getByText('730143309837', {exact: true})).toBeVisible();
  await page.getByPlaceholder('Ejemplo: 4715').fill('4715');
  await page.getByRole('button', {name: 'Consultar por ID'}).click();
  await expect(page.getByText('Depósito · 0 unidades', { exact: true })).toBeVisible();
});

test('Gaming City muestra una búsqueda vacía como resultado válido', async ({ page }) => {
  await page.route('**/api/access/me', r => r.fulfill({json: {id: 1, fullName: 'QA', role: 'Administrator'}}));
  await page.route('**/api/access/gc/status', r => r.fulfill({json: {configured: true}}));
  await page.route('**/api/access/gc/products?*', r => r.fulfill({json: {data: {products: [], total: 0, truncated: false}}}));
  await page.goto('/productos');
  await page.getByLabel('Sede de Gaming City').selectOption({ label: 'Depósito' });
  await page.getByPlaceholder('Nombre o código del producto').fill('sin coincidencias');
  await page.getByRole('button', {name: 'Consultar catálogo'}).click();
  await expect(page.getByText('Sin resultados')).toBeVisible();
});


test('inventario del portal exige sede, envía filtros y limpia el stock al cambiar', async ({ page }) => {
  await page.route('**/api/access/me', r => r.fulfill({ json: { id: 1, fullName: 'QA', role: 'Administrator' } }));
  await page.route('**/api/access/gc/status', r => r.fulfill({ json: { configured: true } }));
  await page.route('**/api/access/gc/products?*', r => {
    const params = new URL(r.request().url()).searchParams;
    expect(params.get('branchId')).toBe('3');
    expect(params.get('onlyInStock')).toBe('true');
    expect(params.get('hideCombos')).toBe('true');
    expect(params.has('iue')).toBe(false);
    return r.fulfill({ json: { data: { products: [{id:'7891', name:'Auricular PlayStation', code:'7891', supplierCode:'', sku:'', price:null, stock:1}], total:1, truncated:false } } });
  });
  await page.goto('/productos?vista=inventario');
  await page.getByPlaceholder('Nombre o código del producto').fill('playstation');
  await expect(page.getByRole('button', { name: 'Consultar catálogo' })).toBeDisabled();
  await page.getByLabel('Sede de Gaming City').selectOption({ label: 'Caballito' });
  await page.getByRole('button', { name: 'Consultar catálogo' }).click();
  await expect(page.getByText('Caballito · 1 unidades', { exact: true })).toBeVisible();
  await page.getByLabel('Sede de Gaming City').selectOption({ label: 'Depósito' });
  await expect(page.getByRole('heading', {name:'Auricular PlayStation'})).toHaveCount(0);
  await expect(page.getByRole('button', {name:'Consultar por ID'})).toHaveCount(0);
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});
