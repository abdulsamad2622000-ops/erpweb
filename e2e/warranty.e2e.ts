import { expect, test } from '@playwright/test';
import { login } from './helpers/auth';
import { openShift, posSale, receiveStock, spaGoto } from './helpers/flows';

test.describe('Warranty and repairs', () => {
  test('A laptop sold at the POS is accepted in warranty and moves to delivered', async ({ page }) => {
    test.setTimeout(120_000);
    await page.addInitScript(() => {
      window.print = () => undefined;
    });
    const serial = '5CG9400001';
    await login(page, 'super');
    await receiveStock(page, [serial]);
    await openShift(page);
    await posSale(page, serial);
    await page.keyboard.press('Escape');

    // Job card: serial scan se warranty check
    await spaGoto(page, '/warranty/new');
    const scan = page.locator('#rn-scan');
    await scan.fill(serial);
    await scan.press('Enter');
    await expect(page.getByText('In warranty').first()).toBeVisible();
    await page.getByLabel(/Problem/).fill('Screen flickers after boot');
    await page.getByLabel('Name', { exact: true }).fill('Walk In Customer');
    await page.getByLabel('Phone', { exact: true }).fill('03001112222');
    await page.getByRole('button', { name: 'Create job card' }).click();
    await expect(page).toHaveURL(/\/warranty\/\d+/);
    await expect(page.getByRole('heading', { name: /JOB-/ })).toBeVisible();

    // Stages: Received -> Checking -> Repairing -> Ready -> Delivered
    for (const step of ['Checking', 'Repairing', 'Ready']) {
      await page.getByRole('button', { name: step, exact: true }).click();
      await expect(page.locator('h1')).toContainText(step);
    }
    await page.getByRole('button', { name: 'Deliver', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Delivered on' })).toBeVisible();
  });
});