import { test, expect } from '@playwright/test';

function invoice() {
  const stream = 'BT /F1 10 Tf 25 700 Td (EAN 7790000000011 Producto QA Cantidad 2 Precio ARS 100,00 Total 200,00) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += 'xref\n0 6\n0000000000 65535 f \n' + offsets.slice(1).map(n => n.toString().padStart(10, '0') + ' 00000 n \n').join('');
  pdf += `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}

test('API real: sesión, Aiven, sucursales y PdfPig desde Angular, sin guardar datos QA', async ({ page }) => {
  test.skip(!process.env['GAMEXID_LIVE_PASSWORD'], 'Requiere credencial privada y API local conectada a Aiven.');
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  const login = await page.request.post('/api/access/login', {
    headers: { 'X-Gamexid': '1' },
    data: { email: process.env['GAMEXID_LIVE_EMAIL'] || 'admin@gamexid.com', password: process.env['GAMEXID_LIVE_PASSWORD'] },
  });
  expect(login.status()).toBe(200);
  await page.goto('/dashboard');
  await expect(page.getByLabel('Sucursal de trabajo').locator('option')).toHaveCount(16, { timeout: 20000 });
  await page.goto('/ingresos');
  await page.getByRole('button', { name: 'Nuevo ingreso' }).click();
  await expect(page.getByLabel('Destino: Depósito')).toHaveValue('Morón (Depósito Central)');
  await page.locator('#ean-scanner-input').fill('GX-UNKNOWN-' + Date.now());
  await page.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(page.getByText('Código sin relación registrada.', { exact: false }).first()).toBeVisible({ timeout: 20000 });
  await page.goto('/sucursales');
  await page.getByRole('button', { name: 'Nuevo pedido' }).click();
  await page.locator('#pedido-pdf').setInputFiles({ name: 'qa.pdf', mimeType: 'application/pdf', buffer: invoice() });
  await page.getByRole('button', { name: 'Extraer con PdfPig' }).click();
  await expect(page.getByLabel('Pedido', { exact: true })).toHaveValue('2', { timeout: 30000 });
  await expect(page.getByLabel('Precio unitario', { exact: true })).toHaveValue('100');
  await expect(page.getByLabel('Importe', { exact: true })).toHaveValue('200');
  await expect(page.getByLabel('Moneda', { exact: true })).toHaveValue('ARS');
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(errors).toEqual([]);
});
