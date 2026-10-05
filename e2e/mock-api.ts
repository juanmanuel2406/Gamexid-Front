import type { Page } from '@playwright/test';
import { OFFICIAL_BRANCHES } from '../src/app/services-gamexid/branches';

export async function mockInventory(page: Page) {
  const products = [
    { id: 1, sku: 'NOTE-001', name: 'Notebook 14" 8GB', ean: '7790000000011', requiresSerialNumber: true, isActive: true },
    { id: 2, sku: 'MOUSE-01', name: 'Mouse inalámbrico', ean: '7790000000028', requiresSerialNumber: false, isActive: true },
  ];
  const units = [{ id: 1, productId: 1, serialNumber: 'NB-10001', currentBranchId: 2, status: 'Available' }];
  const movements: any[] = [];
  const branches = OFFICIAL_BRANCHES.map(([code, name, address], i) => ({ id: i + 2, code, name, address, isActive: true }));
  await page.route('**/api/branches', r => r.fulfill({ json: branches }));
  await page.route('**/api/products', async r => {
    if (r.request().method() === 'POST') {
      const product = { ...r.request().postDataJSON(), id: products.length + 1, isActive: true };
      products.push(product);
      await r.fulfill({ status: 201, json: product });
    } else await r.fulfill({ json: products });
  });
  await page.route('**/api/products/*/units', r => {
    const id = Number(new URL(r.request().url()).pathname.split('/')[3]);
    return r.fulfill({ json: units.filter(u => u.productId === id) });
  });
  await page.route('**/api/products/lookup?*', r => {
    const code = new URL(r.request().url()).searchParams.get('code')!.toUpperCase();
    const unit = units.find(u => u.serialNumber.toUpperCase() === code) || null;
    const product = products.find(p => p.ean === code || p.sku.toUpperCase() === code || p.id === unit?.productId);
    return product
      ? r.fulfill({ json: { product, unit, matchedBy: unit ? 'serial' : product.ean === code ? 'ean' : 'sku', alreadyInInventory: !!unit } })
      : r.fulfill({ status: 404, json: { mensaje: 'Código sin relación registrada.' } });
  });
  await page.route('**/api/inventory/movements', r => r.fulfill({ json: movements }));
  await page.route('**/api/inventory/receipts', r => {
    const body = r.request().postDataJSON();
    const movement = { ...body, id: movements.length + 1, type: 'Ingreso', createdAtUtc: new Date().toISOString() };
    movements.push(movement);
    return r.fulfill({ json: movement });
  });
  await page.route('**/api/documents/extract', r => r.fulfill({
    json: { source: 'pdfpig', lines: [{ ean: '7790000000011', name: 'Notebook 14" 8GB', expected: 3, unitPrice: 1200.5, total: 3601.5, currency: 'ARS', confidence: null }], warnings: ['Revisá las líneas contra el PDF.'], requiresOcr: false },
  }));
}
