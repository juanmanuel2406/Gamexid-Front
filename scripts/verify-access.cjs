// Run manually after deployment. Read the password from stdin, never from a file or argument.
const { chromium, request } = require('@playwright/test');
const readline = require('node:readline/promises');
const assert = require('node:assert/strict');
(async () => {
  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
  const password = await terminal.question('Password (not saved): ');
  terminal.close();
  const baseURL = process.argv[2];
  if (!baseURL || !baseURL.startsWith('https://')) throw new Error('HTTPS URL required');
  const api = await request.newContext({ baseURL });
  assert.equal((await api.get('/api/access/health')).status(), 200);
  assert.equal((await api.get('/api/access/me')).status(), 401);
  assert.equal((await api.post('/api/access/login', { data: {} })).status(), 403);
  assert.equal((await api.post('/api/access/login', { headers: { 'X-Gamexid': '1' }, data: { email: 'admin@gamexid.com', password: 'invalid-password' } })).status(), 401);
  const response = await api.post('/api/access/login', { headers: { 'X-Gamexid': '1' }, data: { email: 'admin@gamexid.com', password } });
  assert.equal(response.status(), 200);
  const cookie = (await api.storageState()).cookies.find(c => c.name === '__Host-Gamexid');
  assert(cookie && cookie.secure && cookie.httpOnly && cookie.sameSite === 'Strict');
  assert.equal((await api.get('/api/access/me')).status(), 200);
  assert.equal((await api.post('/api/access/logout', { headers: { 'X-Gamexid': '1' } })).status(), 204);
  assert.equal((await api.get('/api/access/me')).status(), 401);
  const browser = await chromium.launch({ channel: 'msedge' });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.goto(baseURL + '/login');
    await page.getByLabel('Email', { exact: true }).fill('admin@gamexid.com');
    await page.getByLabel('Contraseña', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await page.waitForURL('**/dashboard');
    await page.reload();
    await page.waitForURL('**/dashboard');
    console.log('PASS: HTTPS, unauthorized requests, CSRF, invalid password, secure cookie, login, logout and browser session persistence.');
  } finally { await browser.close(); await api.dispose(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
