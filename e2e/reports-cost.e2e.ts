import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Cost and profit are hidden', () => {
  test('Store Keeper sees no profit tab or cost column in reports', async ({ page }) => {
    await login(page, 'keeper');
    await page.goto('/reports');
    if (/\/403/.test(page.url())) return; // report hi band hai, cost bhi nahi dikhta
    await expect(page.getByRole('tablist')).toBeVisible();
    await expect(page.getByRole('tab', { name: /profit/i })).toHaveCount(0);
    await expect(page.getByRole('columnheader', { name: /^cost$/i })).toHaveCount(0);
  });
});
