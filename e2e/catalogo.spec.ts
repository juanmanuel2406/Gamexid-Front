import { test, expect } from '@playwright/test';
import { mockInventory } from './mock-api';
test.beforeEach(async ({ page }) => {
  await mockInventory(page);
  await page.route('**/api/access/me', r => r.fulfill({ json: { id: 1, fullName: 'QA', role: 'Administrator' } }));
  await page.route('**/api/access/health', r => r.fulfill({ json: { status: 'ok' } }));
  await page.route('**/api/access/integrations', r => r.fulfill({json:{pdfPig:true}}));
  await page.route('**/api/access/gc/status', r => r.fulfill({ json: { configured: true } }));
});

test('catálogo, navegación y asistente comparten la sucursal seleccionada', async ({ page }) => {
  await page.route('**/api/catalog/products?*', r => {
    const params = new URL(r.request().url()).searchParams;
    const branch = params.get('branchId');
    expect(params.has('iue')).toBe(false);
    return r.fulfill({ json: { data: { products: [{ id: '1', name: 'Producto sede ' + branch, code: 'P', stock: branch === '10' ? 4 : 1, price: null }], total: 1, truncated: false } } });
  });
  await page.goto('/productos');
  await page.getByLabel('Sucursal de trabajo').selectOption('10');
  await expect(page.getByLabel('Sede de Gaming City').locator('option:checked')).toHaveText('Belgrano');
  await expect(page.getByRole('heading', {name:'Producto sede 10', exact:true})).toBeVisible();
  await page.getByLabel('Sede de Gaming City').selectOption({label:'Caballito'});
  await expect(page.getByLabel('Sucursal de trabajo')).toHaveValue('13');
  await expect(page.getByRole('heading', {name:'Producto sede 10', exact:true})).toHaveCount(0);
  await expect(page.getByRole('heading', {name:'Producto sede 13', exact:true})).toBeVisible();
  await page.goto('/dashboard');
  await expect(page.getByLabel('Sucursal de trabajo')).toHaveValue('13');
  await page.getByText('Ver productos disponibles', {exact:true}).click();
  await expect(page.getByRole('heading', {name:'Producto sede 13', exact:true})).toBeVisible();
});

test('el catálogo se carga sin búsqueda y permite recorrer más de cien productos', async ({ page }) => {
  await page.route('**/api/catalog/products?*', r => {
    const n = Number(new URL(r.request().url()).searchParams.get('page'));
    return r.fulfill({ json: { data: { products: [{id: String(n), name: 'Página '+n, stock: 2, price:null}], total: 120, truncated:true } } });
  });
  await page.goto('/productos');
  await expect(page.getByRole('heading', {name:'Página 1', exact:true})).toBeVisible();
  await page.getByRole('button', {name:'Página siguiente'}).click();
  await expect(page.getByRole('heading', {name:'Página 2', exact:true})).toBeVisible();
  await page.getByRole('button', {name:'Página siguiente'}).click();
  await expect(page.getByRole('heading', {name:'Página 3', exact:true})).toBeVisible();
  await expect(page.getByRole('button', {name:'Página siguiente'})).toBeDisabled();
});

test('fallo de otra sede limpia resultados sin reemplazarlos por Morón', async ({ page }) => {
  await page.route('**/api/catalog/products?*', r => {
    const branch = new URL(r.request().url()).searchParams.get('branchId');
    return branch === '13' ? r.fulfill({status:502,json:{mensaje:'No se pudo consultar Caballito.'}})
      : r.fulfill({json:{data:{products:[{id:'1',name:'Producto anterior',stock:2,price:null}],total:1,truncated:false}}});
  });
  await page.goto('/productos');
  await expect(page.getByRole('heading',{name:'Producto anterior'})).toBeVisible();
  await page.getByLabel('Sucursal de trabajo').selectOption('13');
  await expect(page.getByRole('alert')).toContainText('No se pudo consultar Caballito');
  await expect(page.getByRole('heading',{name:'Producto anterior'})).toHaveCount(0);
});
