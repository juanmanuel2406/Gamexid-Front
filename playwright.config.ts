import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', workers: 1, timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:4200', browserName: 'chromium', channel: 'msedge' },
  webServer: { command: 'npm start -- --host 127.0.0.1', url: 'http://127.0.0.1:4200', reuseExistingServer: true, timeout: 120000 }
});
