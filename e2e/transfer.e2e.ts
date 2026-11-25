import { expect, test } from '@playwright/test';
import { login } from './helpers/auth';
import { pickOption, receiveStock, spaGoto } from './helpers/flows';
import { confirmDialog } from './helpers/ui';

test.describe('Inventory: transfer between warehouses', () => {
  test('Request, approve, dispatch and receive with one missing serial', async ({ page }) => {
    const serials = ['5CG9100001', '5CG9100002'];
    await login(page, 'super');
    await receiveStock(page, serials);

    // Naya transfer: Lahore Main Store -> Karachi Main Store
    await spaGoto(page, '/inventory/transfers/new');
    await pickOption(page.getByLabel('From warehouse'), /Lahore Main Store/);
    await pickOption(page.getByLabel('To warehouse'), /Karachi Main Store/);
    const scan = page.getByPlaceholder('Scan or type a serial and press Enter');
    for (const s of serials) {
      await scan.fill(s);
      await scan.press('Enter');
      await expect(page.getByText(s).first()).toBeVisible();
    }
    await page.getByRole('button', { name: 'Request transfer' }).click();
    await expect(page).toHaveURL(/\/inventory\/transfers\/\d+/);
    await expect(page.getByText('Waiting for approval').first()).toBeVisible();

    // Approve
    await page.getByRole('button', { name: 'Approve', exact: true }).click();
    await confirmDialog(page);
    await expect(page.getByText('Approved', { exact: true }).first()).toBeVisible();

    // Dispatch
    await page.getByRole('button', { name: 'Dispatch', exact: true }).click();
    await confirmDialog(page);
    await expect(page.getByText('In transit').first()).toBeVisible();

    // Receive: sirf 1 serial scan, doosra "did not arrive"
    const receiveScan = page.getByPlaceholder('Scan or type a serial and press Enter');
    await receiveScan.fill(serials[0]);
    await receiveScan.press('Enter');
    await expect(page.getByText(/1 of 2 scanned/)).toBeVisible();
    await page.getByRole('button', { name: 'Complete receipt' }).click();
    await confirmDialog(page);
    await expect(page.getByText('Received', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/did not arrive|missing/i).first()).toBeVisible();
  });
});
