import { test, expect } from '@playwright/test';
import { mockInventory } from './mock-api';
function invoicePdf() {
  const stream = 'BT /F1 12 Tf 40 700 Td (EAN 7790000000011 Cantidad 3) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => n.toString().padStart(10, '0') + ' 00000 n \n')
    .join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf);
}
test('PDF: rechaza archivos falsos y extrae datos bajo botón', async ({ page }) => {
  await page.goto('/sucursales');
  await page.getByRole('button', { name: 'Nuevo pedido' }).click();
  const input = page.locator('#pedido-pdf');
  await input.setInputFiles({
    name: 'falso.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('invalid'),
  });
  await expect(page.getByText('El archivo no es un PDF válido.')).toBeVisible();
  await input.setInputFiles({
    name: 'pedido.pdf',
    mimeType: 'application/pdf',
    buffer: invoicePdf(),
  });
  await page.getByRole('button', { name: 'Extraer con PdfPig' }).click();
  await expect(page.getByLabel('EAN', { exact: true })).toHaveValue('7790000000011');
  await expect(page.getByLabel('Producto', { exact: true })).toHaveValue('Notebook 14" 8GB');
  await expect(page.getByLabel('Pedido', { exact: true })).toHaveValue('3');
  await expect(page.getByRole('button', { name: 'Descargar original' })).toBeVisible();
});
test('sesión inválida redirige al login y logo responsive', async ({ page }) => {
  await page.route('**/api/access/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  await page.route('**/api/access/integrations', (route) =>
    route.fulfill({ json: { pdfPig: true } }),
  );
  await page.route('**/api/access/me', (route) => route.fulfill({ status: 401 }));
  await page.goto('/productos');
  await expect(page).toHaveURL(/login/);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.gamexid-logo svg')).toBeVisible();
  await expect(page.locator('.gamexid-logo')).toHaveCSS('opacity', '1');
  await page.screenshot({ path: 'test-results/login-mobile.png', fullPage: true });
});
test.beforeEach(async ({ page }) => {
  await mockInventory(page);
  await page.route('**/api/access/health', (route) => route.fulfill({ json: { status: 'ok' } }));
  await page.route('**/api/access/integrations', (route) =>
    route.fulfill({ json: { pdfPig: true } }),
  );
  await page.route('**/api/access/me', (route) =>
    route.fulfill({ json: { id: 1, fullName: 'QA', role: 'Administrator' } }),
  );
});
test('productos: formulario visible, validación, guardar y Escape', async ({ page }) => {
  await page.goto('/productos');
  await page.getByRole('button', { name: 'Nuevo producto' }).click();
  await expect(page.locator('.p-dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByText('Completá SKU, nombre y EAN.')).toBeVisible();
  await page.getByPlaceholder('Ej: NOTE-002').fill('QA-PROD');
  await page.getByPlaceholder('Ej: Notebook 15"').fill('Producto QA');
  await page.getByPlaceholder('Ej: 7790000000066').fill('7790000000066');
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('cell', { name: 'Producto QA', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Nuevo producto' }).click();
  await page.keyboard.press('Escape');
  await expect(page.locator('.p-dialog')).toHaveCount(0);
});
test('ingreso manual: depósito, EAN vacío, seriales duplicados y confirmación', async ({
  page,
}) => {
  await page.goto('/ingresos');
  await page.getByRole('button', { name: 'Nuevo ingreso' }).click();
  await expect(page.getByLabel('Destino: Depósito')).toHaveValue('Morón (Depósito Central)');
  await page.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(page.getByText('No se recibió una lectura', { exact: false })).toBeVisible();
  await page.locator('#ean-scanner-input').fill('7790000000011');
  await page.locator('#ean-scanner-input').press('Enter');
  await expect(page.locator('#serial-1')).toBeVisible();
  await page.getByLabel('Cantidad esperada').fill('2');
  await page.locator('#serial-1').fill('QA-001\nQA-001');
  await expect(page.getByRole('button', { name: 'Cerrar ingreso' })).toBeDisabled();
  await page.locator('#serial-1').fill('QA-001\nQA-002');
  await page.getByRole('button', { name: 'Cerrar ingreso' }).click();
  await expect(page.locator('.p-dialog')).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByText('Ingreso #1 registrado correctamente.')).toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'Morón (Depósito Central)', exact: true }),
  ).toBeVisible();
});
test('pedido manual: persiste y permite recepción parcial', async ({ page }) => {
  await page.goto('/sucursales');
  await page.getByRole('button', { name: 'Nuevo pedido' }).click();
  await page.getByLabel('Referencia del pedido').fill('QA-PEDIDO');
  await page.getByLabel('Sucursal de destino').selectOption({ label: 'Belgrano' });
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
test('navegación: atajos, menú móvil y vista sin desborde', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.locator('.nav-item.active')).toHaveText(/Operaciones/);
  await page.locator('.page-title').click();
  await page.keyboard.press('3');
  await expect(page).toHaveURL(/productos/);
  await expect(page.locator('.btn-utilidad')).toHaveCount(0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Alternar menú' }).click();
  await expect(page.locator('.shell')).toHaveClass(/menu-abierto/);
  await page.getByRole('link', { name: 'Red de sedes' }).click();
  await expect(page).toHaveURL(/sedes/);
  await expect(page.locator('.shell')).not.toHaveClass(/menu-abierto/);
  await page.goto('/productos');
  await page.getByRole('button', { name: 'Nuevo producto' }).click();
  await expect(page.locator('.p-dialog')).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBeTruthy();
});

test('sedes: stock calculado desde unidades y detalle por sede', async ({ page }) => {
  await page.goto('/sedes');
  const depot = page.locator('.b-card.depot');
  await expect(depot).toContainText('Morón (Depósito Central)');
  await expect(depot.locator('.stock')).toHaveText('1');
  await depot.click();
  await expect(page.locator('.flip-panel')).toContainText('NB-10001');
  await page.getByRole('button', { name: 'Cerrar', exact: true }).click();
  await expect(page.locator('.flip-panel')).toHaveCount(0);
});

test('movimientos: el ingreso confirmado aparece en la auditoría', async ({ page }) => {
  await page.goto('/ingresos');
  await page.getByRole('button', { name: 'Nuevo ingreso' }).click();
  await page.locator('#ean-scanner-input').fill('7790000000028');
  await page.locator('#ean-scanner-input').press('Enter');
  await page.getByRole('button', { name: 'Cerrar ingreso' }).click();
  await page.getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect(page.getByText('Ingreso #1 registrado correctamente.')).toBeVisible();
  await page.goto('/movimientos');
  await expect(page.locator('.tl-item').first()).toContainText('Mouse inalámbrico');
  await page.getByRole('button', { name: /Venta/ }).click();
  await expect(page.getByText('Sin movimientos para este filtro')).toBeVisible();
});

test('PdfPig requiere botón explícito y completa cantidades sin duplicar líneas', async ({
  page,
}) => {
  await page.route('**/api/access/integrations', (route) =>
    route.fulfill({ json: { pdfPig: true } }),
  );
  let sent = 0;
  await page.route('**/api/documents/extract', async (route) => {
    sent++;
    expect(route.request().headers()['x-gamexid']).toBe('1');
    await route.fulfill({
      json: { lines: [{ ean: '7790000000011', name: 'Notebook', expected: 3, unitPrice: 100, confidence: null }], warnings: ['Revisión manual'], requiresOcr: false },
    });
  });
  await page.goto('/sucursales');
  await page.getByRole('button', { name: 'Nuevo pedido' }).click();
  await page
    .locator('#pedido-pdf')
    .setInputFiles({ name: 'pedido.pdf', mimeType: 'application/pdf', buffer: invoicePdf() });
  await expect(page.getByLabel('Pedido', { exact: true })).toHaveCount(0);
  expect(sent).toBe(0);
  await page.getByRole('button', { name: 'Extraer con PdfPig' }).click();
  await expect(page.getByLabel('Pedido', { exact: true })).toHaveValue('3');
  await expect(page.getByLabel('EAN', { exact: true })).toHaveCount(1);
  expect(sent).toBe(1);
  await page.screenshot({ path: 'test-results/intake-desktop.png', fullPage: true });
});
test('auditoría: asociación, discrepancia persistente y búsqueda segura', async ({ page }) => {
  await page.goto('/auditoria');
  await page.getByRole('button', { name: 'Asociar gabinete' }).first().click();
  await page.getByLabel('Serial del gabinete').fill('CASE-QA-001');
  await page.getByRole('button', { name: 'Guardar asociación' }).click();
  await page.getByRole('button', { name: 'Verificar devolución' }).first().click();
  await page.getByLabel('Serial observado en la unidad recibida').fill('SERIAL-INCORRECTO');
  await page.getByRole('button', { name: 'Verificar serial', exact: true }).click();
  await expect(page.locator('#fraud-alert')).toBeVisible();
  await page.screenshot({ path: 'test-results/audit-desktop.png', fullPage: true });
  await page.reload();
  await page.getByLabel('Buscar linaje').fill('CASE-QA');
  await expect(page.locator('mark')).toHaveText('CASE-QA');
  await expect(page.getByText('Discrepancia', { exact: true })).toBeVisible();
});
test('todas las pantallas se adaptan a móvil y no tienen errores de ejecución', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/dashboard');
  await page.screenshot({ path: 'test-results/dashboard-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ['dashboard', 'productos', 'ingresos', 'sucursales', 'auditoria']) {
    await page.goto('/' + route);
    await expect(page.locator('h1')).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
    await page.screenshot({ path: 'test-results/' + route + '-mobile.png', fullPage: true });
  }
  await page.getByRole('button', { name: 'Alternar menú' }).click();
  await expect(page.locator('.shell')).toHaveClass(/menu-abierto/);
  await page.getByRole('button', { name: 'Cerrar menú', exact: true }).click();
  expect(errors).toEqual([]);
});

test('16 sedes reales, direcciones y depósito único', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByLabel('Sucursal de trabajo').locator('option')).toHaveCount(16);
  await page.getByLabel('Sucursal de trabajo').selectOption({ label: 'Belgrano' });
  await page.goto('/sucursales');
  await page.getByRole('button', { name: 'Nuevo pedido' }).click();
  await expect(page.getByText('José Hernández 2438, CABA', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Sucursal de destino').locator('option')).toHaveCount(16);
});
test('conserva los datos locales sin importarlos silenciosamente a MySQL', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('fs_products', JSON.stringify([{ id: 999, name: 'Legacy-only' }]));
    localStorage.setItem('fs_units', JSON.stringify([{ id: 999, serialNumber: 'LEGACY-99' }]));
  });
  await page.goto('/productos');
  await expect(page.getByRole('cell', { name: 'Notebook 14" 8GB', exact: true })).toBeVisible();
  await expect(page.getByText('Legacy-only', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('fs_units')!)[0].serialNumber)).toBe('LEGACY-99');
});

test('scanner resuelve SKU y serial conocido sin duplicar el ingreso', async ({ page }) => {
  await page.goto('/ingresos');
  await page.getByRole('button', { name: 'Nuevo ingreso' }).click();
  await page.locator('#ean-scanner-input').fill('nb-10001');
  await page.locator('#ean-scanner-input').press('Enter');
  await expect(page.getByText('Esta unidad ya está registrada', { exact: false }).first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cerrar ingreso' })).toBeDisabled();
  await expect(page.locator('#serial-1')).toHaveCount(0);
  await page.locator('#ean-scanner-input').fill('NOTE-001');
  await page.locator('#ean-scanner-input').press('Enter');
  await expect(page.locator('#serial-1')).toBeVisible();
  await expect(page.locator('#serial-1')).toBeFocused();
});

test('scanner recupera el botón cuando falla la API', async ({ page }) => {
  await page.route('**/api/products/lookup?*', r => r.fulfill({ status: 503, json: { mensaje: 'MySQL no disponible' } }));
  await page.goto('/ingresos');
  await page.getByRole('button', { name: 'Nuevo ingreso' }).click();
  await page.locator('#ean-scanner-input').fill('NOTE-001');
  await page.getByRole('button', { name: 'Agregar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Agregar', exact: true })).toBeEnabled();
  await expect(page.getByText('MySQL no disponible').first()).toBeVisible();
});

test('logo conserva espacio en la barra lateral y anima en login', async ({ page }) => {
  await page.goto('/dashboard');
  const dimensions = await page.locator('.brand-symbol').boundingBox();
  expect(dimensions?.width).toBe(50);
  expect(dimensions?.height).toBe(40);
  await expect(page.locator('.rail')).toHaveCSS('width', '232px');
  await expect(page.locator('.brand-symbol .head').last()).toHaveCSS('opacity', '1');
  await page.screenshot({ path: 'test-results/sidebar-logo.png' });
  await page.route('**/api/access/me', (route) => route.fulfill({ status: 401 }));
  await page.goto('/login');
  await expect(page.locator('.gamexid-logo')).toHaveCSS('opacity', '1');
  await expect
    .poll(async () =>
      page.locator('.gamexid-logo .head').first().evaluate((el) => getComputedStyle(el).transform),
    )
    .not.toBe('none');
  await expect(page.locator('.gamexid-logo .ltr').last()).toHaveCSS('opacity', '1');
  await page.screenshot({path:'test-results/vector-login-desktop.png',fullPage:true});
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.reload();
  await expect(page.locator('.gamexid-logo .head').first()).toHaveCSS('transform', 'none');
  await expect(page.locator('.gamexid-logo .ltr')).toHaveCount(7);
  await expect(page.locator('.gamexid-logo .bone')).toHaveCount(34);
  expect(await page.locator('.gamexid-logo svg').evaluate(svg=>
    Array.from(svg.querySelectorAll('[fill^="url("]')).every(el=>{
      const id=el.getAttribute('fill')!.slice(5,-1);
      return !!svg.querySelector('[id="'+id+'"]');
    }))).toBe(true);
});
