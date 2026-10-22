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
  await expect(page.getByRole('button', { name: 'Aceptar Notebook' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Rechazar Notebook' })).toBeVisible();
  await expect(page.locator('.suggest-score')).toContainText('88%');
  await expect(page.locator('#serial-1')).toHaveCount(0);
  expect(writes).toBe(0);
  await page.getByRole('button', { name: 'Aceptar Notebook' }).click();
  await expect(page.locator('#serial-1')).toBeVisible();
  await expect(page.locator('#serial-1')).toHaveValue('NOTE-002');
  await expect(page.locator('.suggest')).toHaveCount(0);
  expect(writes).toBe(0);
});

test('rechazar la sugerencia no agrega el producto', async ({ page }) => {
  await page.route('**/api/products/lookup?*', r => r.fulfill({
    status: 404,
    json: { mensaje: 'Sin coincidencia exacta.', suggestions: [{ score: 0.8, product: {
      id: 1, sku: 'NOTE-001', name: 'Notebook', ean: '7790000000011', requiresSerialNumber: true, isActive: true,
    } }] },
  }));
  await page.goto('/ingresos');
  await page.getByRole('button', { name: 'Nuevo ingreso' }).click();
  await page.locator('#ean-scanner-input').fill('NOTE-009');
  await page.locator('#ean-scanner-input').press('Enter');
  await page.getByRole('button', { name: 'Rechazar Notebook' }).click();
  await expect(page.locator('.suggest')).toHaveCount(0);
  await expect(page.locator('.notice', { hasText: 'Sugerencias descartadas' })).toBeVisible();
  await expect(page.locator('#serial-1')).toHaveCount(0);
});

test('inventario consulta la sede y busca serial sin distinguir mayúsculas', async ({ page }) => {
  await page.goto('/productos?vista=inventario');
  await page.getByRole('button', { name: 'Registros Gamexid', exact: true }).click();
  const request = page.waitForRequest(r => r.url().includes('/api/inventory/stock?') && r.url().includes('nb-10001'));
  await expect(page.getByLabel('Sede del inventario')).toBeVisible();
  await page.getByRole('textbox', { name: 'Buscar por nombre, EAN o serial' }).fill('nb-10001');
  const params = new URL((await request).url()).searchParams;
  expect(params.get('branchId')).toBe('2');
  await expect(page.locator('.prod-row')).toHaveCount(1);
  await expect(page.locator('.prod-row .num')).toHaveText('1');
  await expect(page.locator('.spot')).toHaveCount(1);
  await expect(page.locator('.spot-stock b')).toHaveText('1');
});

test('pedido no muestra proveedor ni datos JSON', async ({ page }) => {
  await page.goto('/sucursales');
  await page.getByRole('button', { name: 'Nuevo pedido' }).click();
  await expect(page.getByLabel('Proveedor', { exact: true })).toHaveCount(0);
  await expect(page.locator('.json-pane')).toHaveCount(0);
  await expect(page.locator('pre code')).toHaveCount(0);
});

test('Nuevo ingreso aparece una sola vez: en Ingresos, no en Operaciones', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.locator('.page-head')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Nuevo ingreso' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Nuevo ingreso' })).toHaveCount(0);
  await page.goto('/ingresos');
  await expect(page.getByRole('button', { name: 'Nuevo ingreso' })).toHaveCount(1);
});

test('jerarquía de botones: Nuevo pedido usa el acento propio', async ({ page }) => {
  await page.goto('/sucursales');
  const order = page.getByRole('button', { name: 'Nuevo pedido' });
  await expect(order).toHaveClass(/btn-order/);
  const bg = await order.evaluate(e => getComputedStyle(e).backgroundImage);
  expect(bg).toContain('252, 193, 74');
  await page.goto('/productos?vista=inventario');
  await page.getByRole('button', { name: 'Registros Gamexid', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Nuevo producto' })).toHaveClass(/btn-cta/);
});

test('Nueva sede solo visible para administradores', async ({ page }) => {
  await page.route('**/api/access/me', r => r.fulfill({ json: { id: 2, fullName: 'Vendedor', role: 'Operator', branchId: 2 } }));
  await page.goto('/sedes');
  await expect(page.locator('.page-title')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nueva sede' })).toHaveCount(0);
});

test('cambiar la sede actualiza el stock y el inventario se adapta a móvil', async ({ page }) => {
  await page.goto('/productos?vista=inventario');
  await page.getByRole('button', { name: 'Registros Gamexid', exact: true }).click();
  await page.getByRole('textbox', { name: 'Buscar por nombre, EAN o serial' }).fill('Notebook');
  await expect(page.locator('.spot-stock b')).toHaveText('1');
  await page.getByLabel('Sede del inventario').selectOption({ label: 'Belgrano' });
  await expect(page.locator('.spot-stock b')).toHaveText('0');
  await expect(page.getByRole('columnheader', { name: 'Stock en Belgrano' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel('Sede del inventario')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  await page.screenshot({ path: 'test-results/inventory-ui-mobile.png', fullPage: true });
});
