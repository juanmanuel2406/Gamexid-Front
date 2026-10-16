import { test, expect } from '@playwright/test';
import { mockInventory } from './mock-api';
test('rutas públicas y catálogo integrado', async ({ page }) => {
  await mockInventory(page);
  await page.route('**/api/access/me', r => r.fulfill({json:{id:1,fullName:'QA',role:'Administrator'}}));
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/inicio');
  await expect(page).toHaveURL(/\/$/);
  const nav = page.getByRole('navigation', {name:'Navegación pública'});
  for (const label of ['Inicio','Flujo','Marca','Sedes']) await expect(nav.getByRole('link',{name:label,exact:true})).toBeVisible();
  for (const [label,url] of [['Flujo','/flujo'],['Marca','/marca']]) {
    await nav.getByRole('link',{name:label,exact:true}).click();
    await expect(page).toHaveURL(new RegExp(url+'$'));
    await expect(page.getByRole('heading',{name:label,exact:true})).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading',{name:label,exact:true})).toBeVisible();
    await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  }
  await nav.getByRole('link',{name:'Sedes',exact:true}).click();
  await expect(page).toHaveURL(/\/sedes$/);
  await page.goto('/integracion');
  await expect(page).toHaveURL(/\/productos$/);
  await expect(page.getByRole('link',{name:'Integración GamingCity'})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Consultar catálogo'})).toBeVisible();
  await page.getByRole('button',{name:'Inventario',exact:true}).click();
  await expect(page.getByRole('button',{name:'Nuevo producto'})).toBeVisible();
  await page.getByRole('button',{name:'Catálogo',exact:true}).click();
  await expect(page.getByRole('button',{name:'Consultar catálogo'})).toBeVisible();
  await page.getByRole('button',{name:'Inventario',exact:true}).click();
  await page.setViewportSize({width:1440,height:900});
  await page.getByRole('link',{name:'Catálogo de productos',exact:true}).click();
  await expect(page).toHaveURL(/\/productos$/);
  await expect(page.getByRole('button',{name:'Consultar catálogo'})).toBeVisible();
  expect(errors).toEqual([]);
});
test('Sedes conserva destino al requerir acceso', async ({page}) => {
  await mockInventory(page);
  await page.route('**/api/access/me', r=>r.fulfill({status:401}));
  await page.goto('/');
  await page.getByRole('navigation',{name:'Navegación pública'}).getByRole('link',{name:'Sedes'}).click();
  await expect(page).toHaveURL(/login\?returnUrl=%2Fsedes/);
});
