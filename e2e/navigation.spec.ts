import { test, expect } from '@playwright/test';
import { mockInventory } from './mock-api';
test('portada original y catálogo integrado', async ({ page }) => {
  await mockInventory(page);
  await page.route('**/api/access/me', r => r.fulfill({json:{id:1,fullName:'QA',role:'Administrator'}}));
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('gx-public-nav')).toHaveCount(0);
  await expect(page.locator('.nav').getByRole('link',{name:'Entrar',exact:true})).toBeVisible();
  for (const url of ['/flujo','/marca']) {
    await page.goto(url);
    await expect(page).toHaveURL(/\/$/);
  }
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
