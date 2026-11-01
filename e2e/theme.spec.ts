import { test, expect, Locator } from '@playwright/test';
import { mockInventory } from './mock-api';

async function contraste(elemento: Locator) {
  const valor = await elemento.evaluate(elemento => {
    const estilo = getComputedStyle(elemento);
    const luminancia = (color: string) => {
      const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(v => {
        const canal = v / 255;
        return canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4;
      });
      return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
    };
    const texto = luminancia(estilo.color);
    const fondo = luminancia(estilo.backgroundColor);
    return (Math.max(texto, fondo) + 0.05) / (Math.min(texto, fondo) + 0.05);
  });
  expect(valor).toBeGreaterThanOrEqual(4.5);
}

test('tema oscuro: login, formularios y pedidos conservan legibilidad', async ({ page }) => {
  await mockInventory(page);
  await page.route('**/api/access/me', r => r.fulfill({ json: { id: 1, fullName: 'QA', role: 'Administrator' } }));
  await page.route('**/api/access/health', r => r.fulfill({ json: { status: 'ok' } }));
  await page.route('**/api/access/integrations', r => r.fulfill({ json: { pdfPig: true } }));
  await page.goto('/login');
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark');
  await expect(page.locator('body')).toHaveCSS('font-family', /Outfit/);
  await page.waitForTimeout(1500);
  await contraste(page.locator('.btn-login'));
  await page.screenshot({ path: 'test-results/vengeance-login.png' });
  await page.goto('/sucursales');
  await contraste(page.getByRole('button', { name: 'Nuevo pedido' }));
  await page.getByRole('button', { name: 'Nuevo pedido' }).click();
  await expect(page.getByLabel('Referencia del pedido')).toBeVisible();
  await contraste(page.getByLabel('Referencia del pedido'));
  await page.screenshot({ path: 'test-results/vengeance-pedido.png' });
  await page.goto('/productos');
  await page.screenshot({ path: 'test-results/vengeance-productos.png' });
  await page.goto('/');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'test-results/vengeance-home.png' });
});
