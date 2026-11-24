import { Page, expect } from '@playwright/test';

export type DemoUser = 'super' | 'admin' | 'keeper' | 'accountant';

const EMAIL: Record<DemoUser, string> = {
  super: 'super@demo.test',
  admin: 'admin@demo.test',
  keeper: 'keeper@demo.test',
  accountant: 'accountant@demo.test',
};

/** Mock mode: koi bhi password chalta hai. Super/Admin ko 2FA code 123456 chahiye, Store Keeper ko nahi. */
export async function login(page: Page, who: DemoUser): Promise<void> {
  await page.goto('/login');
  await page.locator('#email').fill(EMAIL[who]);
  await page.locator('#password').fill('demo-password');
  await page.locator('button[type="submit"]').click();
  if (who === 'super' || who === 'admin') {
    await page.locator('#code').fill('123456');
    await page.locator('button[type="submit"]').click();
  }
  await expect(page).toHaveURL(/\/dashboard/);
}
