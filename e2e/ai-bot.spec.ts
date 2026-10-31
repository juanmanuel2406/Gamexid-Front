import { test, expect } from '@playwright/test';
import { mockInventory } from './mock-api';

test.beforeEach(async ({ page }) => {
  await mockInventory(page);
  await page.route('**/api/access/me', r => r.fulfill({ json: { id: 1, fullName: 'QA', role: 'Administrator' } }));
  await page.route('**/api/access/health', r => r.fulfill({ json: { status: 'ok' } }));
  await page.route('**/api/access/integrations', r => r.fulfill({ json: { pdfPig: true } }));
  await page.route('**/api/chat/status', r => r.fulfill({ json: { configured: true } }));
});

test('asistente limitado a Productos y Pedidos', async ({ page }) => {
  for (const path of ['/productos', '/sucursales']) {
    await page.goto(path);
    await expect(page.getByLabel('Abrir asistente de productos y pedidos')).toBeVisible();
  }
  await page.goto('/ingresos');
  await expect(page.getByLabel('Abrir asistente de productos y pedidos')).toHaveCount(0);
});

test('consulta con contexto, imagen real y HTML sin ejecutar', async ({ page }) => {
  const image = 'https://www.gamingcity.com.ar/images/imagen_5658.jpg';
  await page.route(image, r => r.fulfill({ contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jFz0AAAAASUVORK5CYII=', 'base64') }));
  await page.route('**/api/chat/ask', r => {
    const body = r.request().postDataJSON();
    expect(body.contextoPantalla).toBe('Productos');
    expect(body.sucursalId).toBeGreaterThan(0);
    expect(body.mensaje).toContain('coolers');
    return r.fulfill({ json: {
      respuesta: '**Tres ventiladores** <img src=x onerror=alert(1)> ![externa](https://example.com/track.png)',
      productos: [{ id: '5658', name: 'Corsair FANS X 3', code: '5658', description: '', imageUrl: image, webUrl: 'https://www.gamingcity.com.ar/gabinete--det--5658' }],
      fuentes: ['Catálogo Gaming City'], consultadoUtc: '2026-10-30T12:00:00Z',
    } });
  });
  await page.goto('/productos');
  await page.getByLabel('Abrir asistente de productos y pedidos').click();
  await page.getByLabel('Mensaje al asistente').fill('¿Qué gabinete tiene 3 coolers?');
  await page.getByLabel('Enviar consulta').click();
  const chat = page.getByRole('dialog', { name: 'Asistente Gamexid' });
  await expect(chat.locator('strong').filter({ hasText: 'Tres ventiladores' })).toBeVisible();
  await expect(chat.getByRole('img', { name: 'Corsair FANS X 3' })).toBeVisible();
  await expect(chat.locator('img')).toHaveCount(1);
  await expect(chat.locator('[onerror]')).toHaveCount(0);
  await page.getByLabel('Sucursal de trabajo').selectOption('3');
  await expect(chat.getByText('Corsair FANS X 3', { exact: true })).toHaveCount(0);
  await page.getByLabel('Mensaje al asistente').fill('¿Qué gabinete tiene 3 coolers?');
  await page.getByLabel('Enviar consulta').click();
  await expect(chat.getByRole('img', { name: 'Corsair FANS X 3' })).toBeVisible();
  await page.screenshot({ path: 'test-results/asistente-productos.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  const bounds = await chat.boundingBox();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await page.screenshot({ path: 'test-results/asistente-movil.png' });
  await page.getByRole('button', { name: 'Limpiar chat', exact: true }).click();
  await expect(chat.getByText('Corsair FANS X 3', { exact: true })).toHaveCount(0);
});

test('sin clave desactiva consultas y permite comprobar de nuevo', async ({ page }) => {
  await page.route('**/api/chat/status', r => r.fulfill({ json: { configured: false } }));
  await page.goto('/sucursales');
  await page.getByLabel('Abrir asistente de productos y pedidos').click();
  await expect(page.getByLabel('Mensaje al asistente')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Volver a comprobar' })).toBeVisible();
});

test('un límite de consultas conserva el mensaje para reintentar', async ({ page }) => {
  await page.route('**/api/chat/ask', r => r.fulfill({ status: 429, json: {} }));
  await page.goto('/sucursales');
  await page.getByLabel('Abrir asistente de productos y pedidos').click();
  await page.getByLabel('Mensaje al asistente').fill('Último pedido');
  await page.getByLabel('Enviar consulta').click();
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Muchas consultas');
  await expect(page.getByLabel('Mensaje al asistente')).toHaveValue('Último pedido');
  await expect(page.getByLabel('Enviar consulta')).toBeEnabled();
});
