import { expect, test } from '@playwright/test';
import { login } from './helpers/auth';

test.describe('Login and permissions', () => {
  test('Super Admin signs in with a 2FA code', async ({ page }) => {
    await login(page, 'super');
    await expect(page.getByText('Users & roles').first()).toBeVisible();
  });

  test('A wrong 2FA code is rejected', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#email').fill('admin@demo.test');
    await page.locator('#password').fill('demo-password');
    await page.locator('button[type="submit"]').click();
    await page.locator('#code').fill('000000');
    await page.locator('button[type="submit"]').click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).not.toHaveURL(/\/dashboard/);
  });

  test('Store Keeper does not see Users & roles and cannot open it', async ({ page }) => {
    await login(page, 'keeper');
    await expect(page.getByText('Users & roles')).toHaveCount(0);
    await page.goto('/users-roles/users');
    await expect(page).toHaveURL(/\/403/);
  });

  test('A signed-out visitor is sent to the login page', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
