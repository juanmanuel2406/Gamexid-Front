import { test, expect } from '@playwright/test';
import { mockInventory } from './mock-api';
const product = { id: '1', name: 'PROCESADOR AMD RYZEN 5 AM4', code: 'CPU-1', stock: 3 };
const offer = { id: 'offer', source: 'Portal', title: 'Lista del portal', amount: 100000, currency: null, checkedUtc: new Date().toISOString(), url: null };
test.beforeEach(async ({ page }) => {
  await mockInventory(page);
  await page.route('**/api/access/me', r => r.fulfill({ json: { id: 1, fullName: 'QA', role: 'Administrator' } }));
  await page.route('**/api/access/health', r => r.fulfill({ json: { status: 'ok' } }));
  await page.route('**/api/access/integrations', r => r.fulfill({ json: { pdfPig: true } }));
  await page.route('**/api/chat/status', r => r.fulfill({ json: { configured: true } }));
  await page.route('**/api/access/gc/products?*', r => r.fulfill({ json: { data: { products: [product], truncated: false } } }));
  await page.route('**/api/pc-builder/prices/*', r => r.fulfill({ json: { offers: [offer], notices: ['Confirmá la moneda del portal.'] } }));
});
test('presupuesto exige moneda, se invalida al cambiar el armado y funciona en móvil', async ({ page }) => {
  await page.route('**/api/pc-builder/quote', r => {
    const item = r.request().postDataJSON().items[0];
    expect(item.productId).toBe('1'); expect(item.confirmedCurrency).toBe('ARS');
    return r.fulfill({ json: { lines: [], checks: [{ status: 'pending', title: 'BIOS', detail: 'Verificar soporte.' }], totals: [{ currency: 'ARS', amount: 100000 }], missingPrices: 0, checkedUtc: new Date().toISOString() } });
  });
  await page.goto('/arma-tu-pc');
  await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('button', { name: 'Elegir para Procesador' }).click();
  await page.getByRole('radio').check();
  await page.getByLabel('Confirmá la moneda del portal').selectOption('ARS');
  await page.getByRole('button', { name: 'Revisar armado y presupuesto' }).click();
  await expect(page.getByRole('heading', { name: 'Presupuesto orientativo' })).toBeVisible();
  await expect(page.getByText('Por revisar · BIOS')).toBeVisible();
  await page.screenshot({ path: 'test-results/pc-builder-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await expect.poll(() => page.locator('.rail').evaluate(el => el.getBoundingClientRect().right)).toBeLessThanOrEqual(0);
  await page.screenshot({ path: 'test-results/pc-builder-mobile.png', fullPage: true });
  await page.getByLabel('Quitar Procesador', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Presupuesto orientativo' })).toHaveCount(0);
});
test('Mercado Libre no inventa resultados cuando falta autorización', async ({ page }) => {
  await page.route('**/api/pc-builder/mercadolibre/*', r => r.fulfill({ json: { offers: [], notices: ['Falta conectar Mercado Libre.'] } }));
  await page.goto('/arma-tu-pc'); await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('button', { name: 'Elegir para Procesador' }).click();
  await page.getByRole('button', { name: 'Buscar en Mercado Libre' }).click();
  await expect(page.getByText('Falta conectar Mercado Libre.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar esta publicación' })).toHaveCount(0);
});
test('el asistente recibe la selección actual y quitarla elimina el contexto', async ({ page }) => {
  let count = 0;
  await page.route('**/api/chat/ask', r => {
    expect(r.request().postDataJSON().armado).toEqual(count++ === 0 ? [{ slot: 'cpu', productId: '1', quantity: 1 }] : []);
    expect(r.request().postDataJSON().contextoPantalla).toBe('Armado');
    return r.fulfill({ json: { respuesta: 'Falta verificar BIOS.', productos: [], fuentes: [], consultadoUtc: new Date().toISOString() } });
  });
  await page.goto('/arma-tu-pc'); await page.getByRole('button', { name: 'Buscar', exact: true }).click();
  await page.getByRole('button', { name: 'Elegir para Procesador' }).click();
  await page.getByLabel('Abrir asistente de productos y pedidos').click();
  await page.getByLabel('Mensaje al asistente').fill('¿Sirve mi armado?'); await page.getByLabel('Enviar consulta').click();
  await expect(page.getByText('Falta verificar BIOS.')).toBeVisible();
  await page.getByLabel('Cerrar asistente').click(); await page.getByLabel('Quitar Procesador', { exact: true }).click();
  await page.getByLabel('Abrir asistente de productos y pedidos').click();
  await page.getByLabel('Mensaje al asistente').fill('¿Y ahora?'); await page.getByLabel('Enviar consulta').click();
  await expect(page.getByText('Falta verificar BIOS.')).toHaveCount(2);
});
