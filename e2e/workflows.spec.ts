import { test, expect } from '@playwright/test';
function invoicePdf() {
  const stream = 'BT /F1 12 Tf 40 700 Td (EAN 7790000000011 Cantidad 3) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
  ];
  let pdf = '%PDF-1.4\n'; const offsets = [0];
  objects.forEach((object, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n => n.toString().padStart(10, '0') + ' 00000 n \n').join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}
test('PDF: rechaza archivos falsos y relaciona EAN sin inventar cantidades', async ({ page }) => {
  await page.goto('/sucursales');
  await page.getByRole('button', { name: 'Nuevo pedido' }).click();
  const input = page.locator('#pedido-pdf');
  await input.setInputFiles({ name: 'falso.pdf', mimeType: 'application/pdf', buffer: Buffer.from('invalid') });
  await expect(page.getByText('El archivo no es un PDF válido.')).toBeVisible();
  await input.setInputFiles({ name: 'pedido.pdf', mimeType: 'application/pdf', buffer: invoicePdf() });
  await expect(page.getByLabel('EAN', { exact: true })).toHaveValue('7790000000011');
  await expect(page.getByLabel('Producto', { exact: true })).toHaveValue('Notebook 14" 8GB');
  await expect(page.getByLabel('Pedido', { exact: true })).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Descargar original' })).toBeVisible();
});
test('sesión inválida redirige al login y logo responsive', async ({ page }) => {
  await page.route('**/api/access/me', route => route.fulfill({ status: 401 }));
  await page.goto('/productos');
  await expect(page).toHaveURL(/login/);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('svg image')).toBeVisible();
  await expect(page.locator('.gamexid-logo')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: 'test-results/login-mobile.png', fullPage: true });
});
test.beforeEach(async ({ page }) => {
  await page.route('**/api/access/me', route => route.fulfill({ json: { id: 1, fullName: 'QA', role: 'Administrator' } }));
});
test('productos: formulario visible, validación, guardar y Escape', async ({ page }) => {
  await page.goto('/productos');
  await page.getByRole('button', { name: 'Nuevo producto' }).click();
  await expect(page.locator('.modal-overlay > .modal')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText('Completá SKU, nombre y EAN.')).toBeVisible();
  await page.getByPlaceholder('Ej: NOTE-002').fill('QA-PROD');
  await page.getByPlaceholder('Ej: Notebook 15"').fill('Producto QA');
  await page.getByPlaceholder('Ej: 7790000000066').fill('7790000000066');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Producto QA', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Nuevo producto' }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal-overlay')).toHaveCount(0);
});
test('ingreso manual: depósito, EAN vacío, seriales duplicados y confirmación', async ({ page }) => {
  await page.goto('/ingresos');
  await page.getByRole('button', { name: 'Nuevo ingreso' }).click();
  await expect(page.getByLabel('Destino: Depósito')).toHaveValue('Depósito');
  await page.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(page.getByText('No se recibió una lectura', { exact: false })).toBeVisible();
  await page.locator('#ean-scanner-input').fill('7790000000011');
  await page.locator('#ean-scanner-input').press('Enter');
  await expect(page.locator('#serial-1')).toBeVisible();
  await page.locator('#serial-1').fill('QA-001\nQA-001');
  await expect(page.getByRole('button', { name: 'Cerrar ingreso' })).toBeDisabled();
  await page.locator('#serial-1').fill('QA-001\nQA-002');
  await page.getByRole('button', { name: 'Cerrar ingreso' }).click();
  await expect(page.locator('.modal-overlay > .modal')).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByText('Ingreso #1 registrado correctamente.')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Depósito', exact: true })).toBeVisible();
});
test('pedido manual: persiste y permite recepción parcial', async ({ page }) => {
  await page.goto('/sucursales');
  await page.getByRole('button', { name: 'Nuevo pedido' }).click();
  await page.getByLabel('Referencia del pedido').fill('QA-PEDIDO');
  await page.getByLabel('Sucursal de destino').selectOption({ label: 'Sucursal Centro' });
  await page.getByRole('button', { name: 'Agregar producto manualmente' }).click();
  await page.getByLabel('EAN', { exact: true }).fill('7790000000011');
  await page.getByLabel('EAN', { exact: true }).blur();
  await expect(page.getByLabel('Producto', { exact: true })).toHaveValue('Notebook 14" 8GB');
  await page.getByLabel('Pedido', { exact: true }).fill('3');
  await page.getByLabel('Recibido', { exact: true }).fill('1');
  await page.getByRole('button', { name: 'Guardar pedido' }).click();
  await expect(page.getByText('1 productos · 2 unidades pendientes')).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Controlar recepción' }).click();
  await expect(page.getByLabel('Recibido', { exact: true })).toHaveValue('1');
  await page.getByLabel('Llegó todo').check();
  await page.getByRole('button', { name: 'Guardar pedido' }).click();
  await expect(page.getByText('1 productos · 0 unidades pendientes')).toBeVisible();
});
test('menú hover, logo visible y vista móvil sin desborde', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.locator('.shell')).toHaveClass(/menu-cerrado/);
  await page.locator('.sidebar').hover();
  await expect(page.locator('.shell')).not.toHaveClass(/menu-cerrado/);
  await page.locator('.contenido').hover();
  await expect(page.locator('.shell')).toHaveClass(/menu-cerrado/);
  await expect(page.locator('.btn-utilidad')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/productos');
  await page.getByRole('button', { name: 'Nuevo producto' }).click();
  await expect(page.locator('.modal-overlay > .modal')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});
