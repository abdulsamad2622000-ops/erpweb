import { test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { writeFileSync } from 'node:fs';
import { login } from '../helpers/auth';

const ROUTES = [
  '/dashboard', '/reports', '/products/list', '/products/brands', '/products/categories', '/products/barcodes',
  '/purchase/suppliers', '/purchase/orders', '/purchase/grn', '/purchase/returns', '/purchase/payments',
  '/inventory/stock', '/inventory/serials', '/inventory/ledger', '/inventory/transfers', '/inventory/counts',
  '/inventory/adjustments', '/inventory/reservations', '/inventory/alerts', '/inventory/locations',
  '/sales/quotations', '/sales/orders', '/sales/invoices', '/sales/challans', '/sales/pos', '/sales/returns',
  '/customers', '/customers/aging', '/warranty', '/accounts/expenses', '/accounts/cashbook', '/email',
  '/users-roles/users', '/users-roles/roles', '/users-roles/audit',
  '/settings/company', '/settings/branches', '/settings/warehouses', '/settings/locations',
  '/settings/number-series', '/settings/price-tiers', '/settings/costing', '/settings/backup',
  '/scan', '/login',
];

test('accessibility scan (axe)', async ({ page }) => {
  test.setTimeout(15 * 60 * 1000);
  const lines: string[] = [];
  await login(page, 'super');
  for (const r of ROUTES) {
    await page.goto(r);
    await page.waitForLoadState('networkidle');
    const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const bad = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
    for (const v of bad) {
      lines.push(`${r} | ${v.impact} | ${v.id} | ${v.nodes.length} nodes | ${v.nodes[0]?.target?.join(' ')}`);
    }
  }
  writeFileSync('a11y-report.txt', lines.join('\n') || 'No serious or critical issues.');
});
