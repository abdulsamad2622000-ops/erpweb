import { expect, test } from '@playwright/test';
import { login } from './helpers/auth';
import { confirmDialog } from './helpers/ui';

test.describe('Purchase: receive stock (GRN)', () => {
  test('An approved PO becomes a GRN; bad serials are rejected, good ones are posted', async ({ page }) => {
    await login(page, 'super');

    // PO-0108 pehle se approved hai
    await page.goto('/purchase/orders/1');
    await page
      .getByRole('main')
      .locator('button, a')
      .filter({ hasText: 'Receive stock (GRN)' })
      .first()
      .click();
    await expect(page).toHaveURL(/\/purchase\/grn\/\d+/);
    await expect(page.getByText(/Progress.*0 of \d+ received/)).toBeVisible();

    const scan = page.locator('#grn-scan');
    const latest = (serial: string) => page.locator('li', { hasText: serial }).first();

    // Theek serial (Dell line, prefix 5CG)
    await scan.fill('5CG9000001');
    await scan.press('Enter');
    await expect(latest('5CG9000001')).toContainText('Accepted');
    await expect(page.getByText(/Progress.*1 of \d+ received/)).toBeVisible();

    // Wohi serial dobara
    await scan.fill('5CG9000001');
    await scan.press('Enter');
    await expect(latest('5CG9000001')).toContainText('Rejected');
    await expect(latest('5CG9000001')).toContainText('already scanned in this GRN');

    // Stock mein pehle se maujood serial
    await scan.fill('5CG3412XQQ');
    await scan.press('Enter');
    await expect(latest('5CG3412XQQ')).toContainText('already exists in stock');

    // Ghalat model (5CD HP ka hai)
    await scan.fill('5CD9000002');
    await scan.press('Enter');
    await expect(latest('5CD9000002')).toContainText('wrong model');

    // Ghalat format
    await scan.fill('AB');
    await scan.press('Enter');
    await expect(latest('AB')).toContainText('not a valid serial number');

    // Post: sirf 1 accepted item stock mein jayega
    await page.getByRole('button', { name: 'Post GRN' }).click();
    await confirmDialog(page);
    await expect(page.getByText('GRN posted. Stock updated.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Print labels' })).toBeVisible();
    await expect(page.getByText('Posted', { exact: true }).first()).toBeVisible();
  });
});
