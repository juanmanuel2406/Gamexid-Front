import { test, expect } from '@playwright/test';
import { mockInventory } from './mock-api';

test.beforeEach(async ({ page }) => {
  await mockInventory(page);
  await page.route('**/api/access/me', r => r.fulfill({ json: { id: 1, fullName: 'QA', role: 'Administrator' } }));
  await page.route('**/api/access/health', r => r.fulfill({ json: { status: 'ok' } }));
  await page.route('**/api/access/integrations', r => r.fulfill({ json: { pdfPig: true } }));
});

test('la sugerencia no agrega ni registra hasta confirmar', async ({ page }) => {
  let writes = 0;
  page.on('request', r => { if (r.method() === 'POST') writes++; });
  await page.route('**/api/products/lookup?*', r => r.fulfill({
    status: 404,
    json: { mensaje: 'Sin coincidencia exacta.', suggestions: [{ score: 0.875, product: {
      id: 1, sku: 'NOTE-001', name: 'Notebook', ean: '7790000000011', requiresSerialNumber: true, isActive: true,
    } }] },
  }));
  await page.goto('/ingresos');
  await page.getByRole('button', { name: 'Nuevo ingreso' }).click();
  await page.locator('#ean-scanner-input').fill('NOTE-002');
  await page.locator('#ean-scanner-input').press('Enter');
  await expect(page.getByRole('button', { name: 'Confirmar Notebook' })).toBeVisible();
  await expect(page.locator('#serial-1')).toHaveCount(0);
  expect(writes).toBe(0);
  await page.getByRole('button', { name: 'Confirmar Notebook' }).click();
  await expect(page.locator('#serial-1')).toBeVisible();
  expect(writes).toBe(0);
});

test('inventario consulta la sede y busca serial sin distinguir mayúsculas', async ({ page }) => {
  await page.goto('/productos?vista=inventario');
  const request = page.waitForRequest(r => r.url().includes('/api/inventory/stock?') && r.url().includes('nb-10001'));
  await page.getByRole('textbox', { name: 'Buscar productos' }).fill('nb-10001');
  const params = new URL((await request).url()).searchParams;
  expect(params.get('branchId')).toBe('2');
  await expect(page.locator('.prod-row')).toHaveCount(1);
  await expect(page.locator('.prod-row .num')).toHaveText('1');
});

test('pedido no muestra proveedor ni datos JSON', async ({ page }) => {
  await page.goto('/sucursales');
  await page.getByRole('button', { name: 'Nuevo pedido' }).click();
  await expect(page.getByLabel('Proveedor', { exact: true })).toHaveCount(0);
  await expect(page.locator('.json-pane')).toHaveCount(0);
});
