import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Cost and profit are hidden', () => {
  test('Store Keeper cannot open reports', async ({ page }) => {
    await login(page, 'keeper');
    await expect(page.getByRole('link', { name: /^reports$/i })).toHaveCount(0);
    await page.goto('/reports');
    await expect(page.getByRole('tablist')).toHaveCount(0);
  });

  test('Accountant sees reports but no Profit & loss tab and no cost column', async ({ page }) => {
    await login(page, 'accountant');
    await page.goto('/reports');
    await expect(page.getByRole('tab', { name: 'Sales & profit' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Profit & loss' })).toHaveCount(0);
    await page.getByRole('tab', { name: 'Sales & profit' }).click();
    await expect(page.getByRole('columnheader', { name: /^cost$/i })).toHaveCount(0);
    await expect(page.getByText(/^cost$/i)).toHaveCount(0);
  });

  test('Super Admin sees the Profit & loss tab and cost column', async ({ page }) => {
    await login(page, 'super');
    await page.goto('/reports');
    await expect(page.getByRole('tab', { name: 'Profit & loss' })).toBeVisible();
    await page.getByRole('tab', { name: 'Sales & profit' }).click();
    await expect(page.getByRole('columnheader', { name: /^cost$/i })).toBeVisible();
  });
});
