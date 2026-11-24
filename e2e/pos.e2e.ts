import { expect, test } from '@playwright/test';
import { login } from './helpers/auth';
import { openShift, posSale, receiveStock, spaGoto } from './helpers/flows';

test.describe('Retail POS', () => {
  test('Cashier sells a laptop with the keyboard, then returns it', async ({ page }) => {
    test.setTimeout(90_000);
    const serial = '5CG9200001';
    await login(page, 'super');
    await receiveStock(page, [serial]);
    await openShift(page);
    await posSale(page, serial);
    await expect(page.getByRole('dialog')).toContainText(/INV-\d+/);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Return: serial scan karo, wajah likho, confirm
    await spaGoto(page, '/sales/returns');
    const find = page.locator('#sr-scan');
    await find.fill(serial);
    await find.press('Enter');
    await expect(page.getByText('Items being returned')).toBeVisible();
    await page.locator('#sr-reason').fill('Customer changed his mind');
    await page.getByRole('button', { name: 'Confirm return' }).click();
    await expect(page.getByRole('status').filter({ hasText: /Return SR-\d+ saved/ })).toBeVisible();

    // Serial wapas stock mein
    await spaGoto(page, '/inventory/serials/' + serial);
    await expect(page.locator('main')).toContainText(/in stock/i);
  });
});