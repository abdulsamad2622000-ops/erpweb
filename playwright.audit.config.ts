import { defineConfig, devices } from '@playwright/test';

// Responsive audit: normal e2e se alag (npx playwright test -c playwright.audit.config.ts)
export default defineConfig({
  testDir: './e2e/audit',
  testMatch: '**/*.audit.ts',
  timeout: 20 * 60_000,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    baseURL: 'http://localhost:4200',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});