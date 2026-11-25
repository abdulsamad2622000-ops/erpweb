import { Page, test } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface Issue {
  width: number;
  route: string;
  kind: 'overflow' | 'redirect' | 'console' | 'alert' | 'small-target' | 'load-error';
  detail: string;
}

const VIEWPORTS = [
  { name: '360', width: 360, height: 740 },
  { name: '768', width: 768, height: 1024 },
  { name: '1280', width: 1280, height: 800 },
];

// Sirf wo routes jin mein :id nahi hai (detail pages baad mein alag se).
const ROUTES = [
  'dashboard', 'reports',
  'products/list', 'products/list/new', 'products/list/import', 'products/brands', 'products/categories',
  'products/barcodes', 'products/barcodes/templates',
  'purchase/suppliers', 'purchase/orders', 'purchase/orders/new', 'purchase/grn', 'purchase/payments', 'purchase/returns',
  'inventory/stock', 'inventory/alerts', 'inventory/serials', 'inventory/locations', 'inventory/putaway',
  'inventory/ledger', 'inventory/transfers', 'inventory/transfers/new', 'inventory/counts', 'inventory/counts/new',
  'inventory/adjustments', 'inventory/adjustments/new', 'inventory/reservations', 'inventory/reservations/new',
  'sales/quotations', 'sales/quotations/new', 'sales/orders', 'sales/orders/new', 'sales/challans', 'sales/invoices',
  'sales/pos', 'sales/returns', 'customers', 'customers/aging',
  'warranty', 'warranty/new', 'accounts/expenses', 'accounts/cashbook', 'email',
  'users-roles/users', 'users-roles/roles', 'users-roles/roles/new', 'users-roles/audit',
  'settings/company', 'settings/branches', 'settings/warehouses', 'settings/locations',
  'settings/number-series', 'settings/price-tiers', 'settings/costing', 'settings/backup',
  'scan', 'scan/putaway', 'scan/transfers', 'scan/counts', 'scan/lookup', 'scan/sync',
];

const OUT = path.resolve('audit-output');
const issues: Issue[] = [];
let checked = 0;

async function signIn(page: Page): Promise<void> {
  await page.goto('/login');
  await page.locator('#email').fill('super@demo.test');
  await page.locator('#password').fill('Demo@12345');
  await page.locator('#password').press('Enter');
  await page.locator('#code').fill('123456');
  await page.locator('#code').press('Enter');
  await page.waitForURL((url) => !/\/(login|forgot-password)/.test(url.pathname), { timeout: 20_000 });
}

async function auditRoute(page: Page, route: string, width: number, shotDir: string): Promise<void> {
  const add = (kind: Issue['kind'], detail: string): void => {
    issues.push({ width, route, kind, detail });
  };
  const errors: string[] = [];
  const onConsole = (m: { type(): string; text(): string }): void => {
    const text = m.text();
    if (m.type() === 'error' && !/favicon|PrimeUI/i.test(text)) errors.push(text.slice(0, 160));
  };
  const onPageError = (e: Error): void => {
    errors.push(`pageerror: ${e.message.slice(0, 160)}`);
  };
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  try {
    await page.goto(`/${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => undefined);
    await page.waitForTimeout(600);
    checked++;

    const finalPath = new URL(page.url()).pathname;
    if (finalPath !== `/${route}`) add('redirect', `opened ${finalPath} instead`);

    const layout = await page.evaluate(() => {
      const vw = window.innerWidth;
      const doc = document.documentElement;
      const offenders: string[] = [];
      const inScroller = (el: Element): boolean => {
        for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
          const ox = getComputedStyle(p).overflowX;
          if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return true;
        }
        return false;
      };
      const scrolls = doc.scrollWidth > vw + 1;
      if (scrolls) {
        for (const el of Array.from(document.body.querySelectorAll('*'))) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.right <= vw + 1) continue;
          const cs = getComputedStyle(el);
          if (cs.position === 'fixed' || cs.visibility === 'hidden' || cs.display === 'none') continue;
          const nested = inScroller(el);
          if (nested && cs.position !== 'absolute') continue;
          offenders.push(`${nested ? '[escapes-scroller] ' : ''}${el.tagName.toLowerCase()}.${String(el.getAttribute('class') ?? '').slice(0, 60)} pos=${cs.position} right=${Math.round(r.right)}`);
          if (offenders.length >= 4) break;
        }
      }
      const small: string[] = [];
      const sel = 'button, a[href], select, textarea, input:not([type=hidden]):not([type=checkbox]):not([type=radio])';
      for (const el of Array.from(document.querySelectorAll(sel))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        if (el.closest('.sr-only')) continue;
        if (el.tagName === 'A' && el.closest('p, li, td, dd, summary')) continue;
        if (r.height < 40) {
          small.push(`${el.tagName.toLowerCase()} "${(el.textContent ?? '').trim().slice(0, 24)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      }
      return { scrolls, over: doc.scrollWidth - vw, offenders, small };
    });

    if (layout.scrolls) add('overflow', `page scrolls sideways by ${layout.over}px. ${layout.offenders.join(' | ')}`);
    if (width === 360 && layout.small.length) {
      add('small-target', `${layout.small.length} small (under 40px high): ${layout.small.slice(0, 3).join(' | ')}`);
    }

    const alerts = await page.locator('[role="alert"]').allInnerTexts();
    if (alerts.length) add('alert', alerts.map((a) => a.trim().slice(0, 80)).join(' | '));
    if (errors.length) add('console', errors.slice(0, 3).join(' | '));

    fs.mkdirSync(shotDir, { recursive: true });
    await page.screenshot({ path: path.join(shotDir, `${route.replace(/\//g, '__')}.png`) });
  } catch (e) {
    add('load-error', String((e as Error).message).slice(0, 160));
  } finally {
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
  }
}

function writeReport(): void {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(issues, null, 2));
  const lines: string[] = [`Pages checked (route x width): ${checked}`, `Issues: ${issues.length}`, ''];
  const kinds = ['overflow', 'redirect', 'load-error', 'console', 'alert', 'small-target'] as const;
  for (const k of kinds) lines.push(`${k}: ${issues.filter((i) => i.kind === k).length}`);
  lines.push('');
  for (const k of kinds) {
    const list = issues.filter((i) => i.kind === k);
    if (!list.length) continue;
    lines.push(`=== ${k.toUpperCase()} ===`);
    for (const i of list) lines.push(`[${i.width}px] /${i.route}  ${i.detail}`);
    lines.push('');
  }
  fs.writeFileSync(path.join(OUT, 'report.txt'), lines.join('\n'));
}

test.describe.configure({ mode: 'serial' });

for (const vp of VIEWPORTS) {
  test(`responsive audit at ${vp.name}px`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await signIn(page);
    for (const route of ROUTES) {
      await auditRoute(page, route, vp.width, path.join(OUT, vp.name));
    }
  });
}

test.afterAll(() => {
  writeReport();
});