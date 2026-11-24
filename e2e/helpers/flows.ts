import { Locator, Page, expect } from '@playwright/test';
import { confirmDialog } from './ui';

/** Page reload kiye baghair route badalta hai (mock data reload par ud jata hai). */
export async function spaGoto(page: Page, path: string): Promise<void> {
  await page.evaluate((p) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate', { state: {} }));
  }, path);
  await expect(page).toHaveURL(new RegExp(path.replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&')));
}

/** Native select mein option ko uske text se chunta hai (value ka format app par chhod kar). */
export async function pickOption(select: Locator, text: RegExp): Promise<void> {
  const value = await select.locator('option').filter({ hasText: text }).first().getAttribute('value');
  if (value === null) throw new Error('Option not found: ' + String(text));
  await select.selectOption(value);
}

/** PO-0108 se GRN banata aur post karta hai. Ye page.goto karta hai, isliye test ki shuruat mein chalayein. */
export async function receiveStock(page: Page, serials: string[]): Promise<void> {
  await page.goto('/purchase/orders/1');
  await page.getByRole('main').locator('button, a').filter({ hasText: 'Receive stock (GRN)' }).first().click();
  await expect(page).toHaveURL(/\/purchase\/grn\/\d+/);
  const scan = page.locator('#grn-scan');
  for (const s of serials) {
    await scan.fill(s);
    await scan.press('Enter');
    await expect(page.locator('li', { hasText: s }).first()).toContainText('Accepted');
  }
  await page.getByRole('button', { name: 'Post GRN' }).click();
  await confirmDialog(page);
  await expect(page.getByText('GRN posted. Stock updated.')).toBeVisible();
}

/** POS: counter chun kar shift kholta hai. spaGoto se chalta hai, isliye mock data reload se nahi udta. */
export async function openShift(page: Page): Promise<void> {
  await spaGoto(page, '/sales/pos');
  await pickOption(page.locator('#pos-wh'), /Lahore Main Store/);
  await page.locator('#pos-open-cash').fill('1000');
  await page.getByRole('button', { name: 'Open shift', exact: true }).click();
  await expect(page.locator('#pos-scan')).toBeVisible();
}

/** Sirf keyboard se sale: F2 scan, Enter, F9 pay. */
export async function posSale(page: Page, serial: string): Promise<void> {
  await page.keyboard.press('F2');
  const scan = page.locator('#pos-scan');
  await scan.fill(serial);
  await scan.press('Enter');
  await expect(page.locator('table').getByText(serial)).toBeVisible();
  await page.keyboard.press('F9');
  await expect(page.getByRole('dialog')).toContainText('Sale complete');
}