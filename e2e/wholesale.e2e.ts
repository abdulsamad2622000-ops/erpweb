import { expect, test } from '@playwright/test';
import { login } from './helpers/auth';
import { pickOption, receiveStock, spaGoto } from './helpers/flows';

test.describe('Wholesale sales', () => {
  test('Order, delivery, credit invoice with part payment, credit return', async ({ page }) => {
    test.setTimeout(120_000);
    const serials = ['5CG9300001', '5CG9300002'];
    await login(page, 'super');
    await receiveStock(page, serials);

    // 1) Naya wholesale customer, credit limit ke saath
    await spaGoto(page, '/customers');
    await page.getByRole('button', { name: /New customer/ }).click();
    const form = page.getByRole('dialog');
    await form.getByLabel('Name', { exact: true }).fill('Test Traders');
    await form.getByLabel('Phone', { exact: true }).fill('03111234567');
    await form.getByLabel(/Credit limit/).fill('500000');
    await form.getByRole('button').last().click();
    await expect(form).toHaveCount(0);
    await expect(page.getByText('Test Traders')).toBeVisible();

    // 2) Sales order (2 laptops, wholesale price)
    await spaGoto(page, '/sales/orders/new');
    await page.locator('#df-cust').fill('Test');
    await page.getByRole('button', { name: /Test Traders/ }).click();
    await page.locator('#df-prod').fill('Latitude');
    await page.getByRole('button', { name: /Dell Latitude 5440/ }).click();
    await page.getByLabel('Qty Dell Latitude 5440').fill('2');
    await page.getByRole('button', { name: /save/i }).click();
    await expect(page).toHaveURL(/\/sales\/orders\/\d+/);
    await expect(page.getByRole('heading', { name: /Sales order SO-/ })).toBeVisible();

    // 3) Delivery: serials scan karke challan
    await page.getByRole('button', { name: 'Deliver', exact: true }).click();
    await pickOption(page.locator('#dl-wh'), /Lahore Main Store/);
    const scan = page.locator('#dl-scan');
    for (const s of serials) {
      await scan.fill(s);
      await scan.press('Enter');
      await expect(page.getByRole('button', { name: new RegExp(s) })).toBeVisible();
    }
    await page.getByRole('button', { name: /Create challan/ }).click();
    await expect(page).toHaveURL(/\/sales\/challans\/\d+/);
    await expect(page.getByRole('heading', { name: /Delivery challan DC-/ })).toBeVisible();

    // 4) Invoice: 100000 abhi, baqi udhaar (credit limit ke andar)
    await page.getByLabel('Paid now').fill('100000');
    await expect(page.getByText(/goes on credit/)).toBeVisible();
    await page.getByRole('button', { name: 'Create invoice' }).click();
    await expect(page).toHaveURL(/\/sales\/invoices\/\d+/);
    await expect(page.getByRole('heading', { name: /Invoice INV-W/ })).toBeVisible();
    await expect(page.getByText('Part paid').first()).toBeVisible();

    // 5) Return: ek laptop, customer ke khate mein credit
    await spaGoto(page, '/sales/returns');
    const find = page.locator('#sr-scan');
    await find.fill(serials[0]);
    await find.press('Enter');
    await expect(page.getByText('Items being returned')).toBeVisible();
    await page.locator('#sr-reason').fill('Customer returned one laptop');
    await page.getByRole('button', { name: 'Confirm return' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Credit to customer account' })).toBeVisible();

    // 6) Khata: 310000 - 100000 - 155000 = 55000 baqi
    await spaGoto(page, '/customers');
    await page.locator('tr', { hasText: 'Test Traders' }).getByRole('link', { name: /ledger/i }).click();
    await expect(page).toHaveURL(/\/customers\/\d+\/ledger/);
    await expect(page.locator('main')).toContainText(/55,000/);
  });
});