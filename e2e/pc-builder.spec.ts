import { test, expect } from '@playwright/test';
import { mockInventory } from './mock-api';
const product = { id: '1', name: 'PROCESADOR AMD RYZEN 5 AM4', code: 'CPU-1', stock: 3, price: 158400 };
const start = async (page: import('@playwright/test').Page) => { await page.goto('/arma-tu-pc'); await page.getByRole('button', { name: 'Comenzar con AMD' }).click(); };
const pickCpu = async (page: import('@playwright/test').Page) => { await page.locator('.product-card').first().getByRole('button', { name: 'Elegir' }).click(); await expect(page.getByRole('heading', { name: 'Elegí tu motherboard' })).toBeVisible(); await page.getByRole('button', { name: /Resumen y presupuesto/ }).click(); };
const offer = { id: 'offer', source: 'Portal', title: 'Lista del portal', amount: 100000, currency: null, checkedUtc: new Date().toISOString(), url: null };
test.beforeEach(async ({ page }) => {
  await mockInventory(page);
  await page.route('**/api/access/me', r => r.fulfill({ json: { id: 1, fullName: 'QA', role: 'Administrator' } }));
  await page.route('**/api/access/health', r => r.fulfill({ json: { status: 'ok' } }));
  await page.route('**/api/access/integrations', r => r.fulfill({ json: { pdfPig: true } }));
  await page.route('**/api/chat/status', r => r.fulfill({ json: { configured: true } }));
  await page.route('**/api/pc-builder/options', r => r.fulfill({ json: { products: [{ product, checks: [] }], truncated: false, missingSteps: [] } }));
  await page.route('**/api/pc-builder/prices/*', r => r.fulfill({ json: { offers: [offer], notices: ['Confirmá la moneda del portal.'] } }));
});
test('presupuesto exige moneda, se invalida al cambiar el armado y funciona en móvil', async ({ page }) => {
  await page.route('**/api/pc-builder/quote', r => {
    const item = r.request().postDataJSON().items[0];
    expect(item.productId).toBe('1'); expect(item.confirmedCurrency).toBe('ARS');
    return r.fulfill({ json: { lines: [], checks: [{ status: 'pending', title: 'BIOS', detail: 'Verificar soporte.' }], totals: [{ currency: 'ARS', amount: 100000 }], missingPrices: 0, checkedUtc: new Date().toISOString() } });
  });
  await start(page);
  await expect(page.getByRole('heading', { name: 'Elegí tu procesador' })).toBeVisible();
  await expect(page.locator('nav.steps .step')).toHaveCount(9);
  await pickCpu(page);
  await expect(page.getByText('Confirmá la moneda del portal.', { exact: true })).toBeVisible();
  await page.getByRole('radio').check();
  await page.getByLabel('Confirmá la moneda del portal').selectOption('ARS');
  await expect(page.locator('.running')).toContainText('100.000,00');
  await page.getByRole('button', { name: 'Calcular presupuesto' }).click();
  await expect(page.getByRole('heading', { name: 'Presupuesto orientativo' })).toBeVisible();
  await expect(page.getByText('Por revisar · BIOS: Verificar soporte.')).toBeVisible();
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
  await start(page); await pickCpu(page);
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
  await start(page); await pickCpu(page);
  await page.getByLabel('Abrir asistente de productos y pedidos').click();
  await page.getByLabel('Mensaje al asistente').fill('¿Sirve mi armado?'); await page.getByLabel('Enviar consulta').click();
  await expect(page.getByText('Falta verificar BIOS.')).toBeVisible();
  await page.getByLabel('Cerrar asistente').click(); await page.getByLabel('Quitar Procesador', { exact: true }).click();
  await page.getByLabel('Abrir asistente de productos y pedidos').click();
  await page.getByLabel('Mensaje al asistente').fill('¿Y ahora?'); await page.getByLabel('Enviar consulta').click();
  await expect(page.getByText('Falta verificar BIOS.')).toHaveCount(2);
});

test('el chat se puede cerrar con movimiento reducido', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/arma-tu-pc');
  await page.getByLabel('Abrir asistente de productos y pedidos').click();
  await expect(page.getByRole('dialog', { name: 'Asistente Gamexid' })).toBeVisible();
  await page.getByLabel('Cerrar asistente').click();
  await expect(page.getByRole('dialog', { name: 'Asistente Gamexid' })).toHaveCount(0);
});

test('elegir plataforma filtra procesadores y se puede reiniciar con movimiento reducido', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const searches: string[] = [];
  await page.route('**/api/pc-builder/options', r => { searches.push(r.request().postDataJSON().search); return r.fulfill({ json: { products: [{product,checks:[]}], missingSteps:[], truncated:false } }); });
  await page.goto('/arma-tu-pc');
  await page.getByRole('button', { name: 'Comenzar con Intel' }).click();
  await expect(page.locator('.chip')).toHaveText('Intel');
  await expect.poll(() => searches[0]).toBe('PROCESADOR INTEL');
  await expect(page.getByRole('button', { name: 'Siguiente paso' })).toBeDisabled();
  await page.getByRole('button', { name: 'Reiniciar' }).click();
  await expect(page.getByRole('button', { name: 'Comenzar con AMD' })).toBeVisible();
});

test('cambiar sucursal descarta armado y envía la sede nueva al buscar y cotizar', async ({ page }) => {
  const branches: number[] = [];
  await page.route('**/api/pc-builder/options', r => {
    const body = r.request().postDataJSON(); branches.push(body.branchId);
    return r.fulfill({json:{products:[{product:{...product,name:'CPU sede '+body.branchId},checks:[]}],missingSteps:[],truncated:false}});
  });
  await start(page);
  await page.locator('.product-card').getByRole('button',{name:'Elegir',exact:true}).click();
  await page.getByRole('button',{name:/Resumen y presupuesto/}).click();
  await expect(page.locator('.chosen')).toHaveCount(1);
  await page.getByLabel('Sucursal de trabajo').selectOption('10');
  await expect(page.getByRole('heading',{name:'Armá tu PC paso a paso'})).toBeVisible();
  await expect(page.locator('.chosen')).toHaveCount(0);
  await page.getByRole('button',{name:'Comenzar con AMD',exact:true}).click();
  await expect(page.getByRole('heading',{name:'CPU sede 10'})).toBeVisible();
  expect(branches.at(-1)).toBe(10);
  await page.route('**/api/pc-builder/prices/*',r=>{
    expect(new URL(r.request().url()).searchParams.get('branchId')).toBe('10');
    return r.fulfill({json:{offers:[{...offer,currency:'ARS'}],notices:[]}});
  });
  await page.locator('.product-card').getByRole('button',{name:'Elegir',exact:true}).click();
  await page.getByRole('button',{name:/Resumen y presupuesto/}).click();
  await page.route('**/api/pc-builder/quote',r=>{
    expect(r.request().postDataJSON().branchId).toBe(10);
    return r.fulfill({json:{lines:[],checks:[],totals:[],missingPrices:0,checkedUtc:new Date().toISOString()}});
  });
  await page.getByRole('button',{name:'Calcular presupuesto'}).click();
  await expect(page.getByRole('heading',{name:'Presupuesto orientativo'})).toBeVisible();
});


test('cooler incluido se cotiza sin otro componente y se limpia al cambiar CPU o sede', async ({ page }) => {
  await page.route('**/api/pc-builder/prices/*', r => r.fulfill({json:{offers:[{...offer,currency:'ARS'}],notices:[],cooling:{status:'included',detail:'Incluye cooler.'}}}));
  await page.route('**/api/pc-builder/quote', r => {
    const items = r.request().postDataJSON().items;
    expect(items).toHaveLength(1); expect(items[0].useIncludedCooler).toBe(true);
    return r.fulfill({json:{lines:[],checks:[],totals:[{currency:'ARS',amount:100000}],missingPrices:0,checkedUtc:new Date().toISOString()}});
  });
  await start(page); await pickCpu(page);
  await page.locator('.step[data-slot="cooler"]').click();
  await page.getByRole('button',{name:'Usar cooler incluido',exact:true}).click();
  await expect(page.getByRole('button',{name:'Ver resumen',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Ver resumen',exact:true}).click();
  await expect(page.getByText('Refrigeración: cooler incluido con el procesador',{exact:false})).toBeVisible();
  await page.getByRole('button',{name:'Calcular presupuesto'}).click();
  await expect(page.getByRole('heading',{name:'Presupuesto orientativo'})).toBeVisible();
  await page.getByLabel('Quitar Procesador',{exact:true}).click();
  await expect(page.getByText('Refrigeración: cooler incluido con el procesador',{exact:false})).toHaveCount(0);
  await page.getByLabel('Sucursal de trabajo').selectOption('10');
  await expect(page.getByRole('heading',{name:'Armá tu PC paso a paso'})).toBeVisible();
});

test('cooler desconocido requiere confirmación y bulk no ofrece usar incluido', async ({ page }) => {
  let status='unknown';
  await page.route('**/api/pc-builder/prices/*', r => r.fulfill({json:{offers:[],notices:[],cooling:{status,detail:'Revisá la presentación.'}}}));
  await start(page); await pickCpu(page); await page.locator('.step[data-slot="cooler"]').click();
  const button=page.getByRole('button',{name:'Usar cooler incluido',exact:true});
  await expect(button).toBeDisabled();
  await page.getByLabel('Confirmé que esta unidad incluye cooler').check(); await button.click();
  await expect(page.getByText('Seleccionado: cooler incluido · sin costo adicional')).toBeVisible();
  status='excluded'; await page.getByRole('button',{name:/Resumen y presupuesto/}).click();
  await page.getByRole('button',{name:'Actualizar precios'}).click();
  await page.locator('.step[data-slot="cooler"]').click();
  await expect(button).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Ver resumen',exact:true})).toBeDisabled();
});
