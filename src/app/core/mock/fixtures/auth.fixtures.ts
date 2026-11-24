import { Branch, UserLimits, UserType } from '../../auth/auth.models';
import { flattenMenu } from '../../nav/menu.config';
import { FixtureHandler, fail, ok } from './fixture.types';

// Mock users (password koi bhi, khali nahi). 2FA code: 123456
const SESSION_KEY = 'erp.mock.session';
const PENDING_KEY = 'erp.mock.pending';
const VALID_CODE = '123456';

interface MockUser {
  email: string;
  id: number;
  name: string;
  role: string;
  type: UserType;
  twoFactor: boolean;
  keys: string[];
  branches: Branch[];
  limits: UserLimits | null;
}

const CRUD_KEYS = ['products.product', 'products.brand', 'products.category', 'users.user', 'users.role'].flatMap((p) =>
  ['create', 'edit', 'delete'].map((a) => `${p}.${a}`),
);
const LABEL_KEYS = ['barcode.label.create', 'barcode.label.print', 'barcode.label.reprint'];
const PURCHASE_KEYS = [
  'purchase.supplier.create', 'purchase.supplier.edit', 'purchase.order.create', 'purchase.order.edit',
  'purchase.order.approve', 'purchase.grn.create',
];
// Code mein istemal hone wali sab permission keys (Playwright aur demo ke liye Super Admin ko sab milti hain).
const EXTRA_KEYS = [
  'accounts.cashbook.view',
  'accounts.expense.create',
  'accounts.expense.edit',
  'accounts.expense.view',
  'barcode.label.create',
  'barcode.label.print',
  'barcode.label.reprint',
  'barcode.label.view',
  'customers.customer.create',
  'customers.customer.edit',
  'customers.customer.view',
  'dashboard.view.view',
  'email.message.send',
  'email.template.edit',
  'email.template.view',
  'inventory.adjustment.approve',
  'inventory.adjustment.create',
  'inventory.adjustment.view',
  'inventory.count.approve',
  'inventory.count.create',
  'inventory.count.view',
  'inventory.ledger.view',
  'inventory.location.view',
  'inventory.putaway.create',
  'inventory.reservation.create',
  'inventory.reservation.view',
  'inventory.serial.view',
  'inventory.stock.view',
  'inventory.transfer.create',
  'inventory.transfer.view',
  'pos.sale.create',
  'products.brand.create',
  'products.brand.delete',
  'products.brand.edit',
  'products.brand.view',
  'products.category.create',
  'products.category.delete',
  'products.category.edit',
  'products.category.view',
  'products.cost.view',
  'products.product.create',
  'products.product.delete',
  'products.product.edit',
  'products.product.view',
  'purchase.grn.create',
  'purchase.grn.view',
  'purchase.order.approve',
  'purchase.order.create',
  'purchase.order.edit',
  'purchase.order.view',
  'purchase.payment.create',
  'purchase.payment.view',
  'purchase.return.create',
  'purchase.return.view',
  'purchase.supplier.create',
  'purchase.supplier.edit',
  'purchase.supplier.view',
  'reports.report.view',
  'sales.challan.create',
  'sales.challan.view',
  'sales.invoice.create',
  'sales.invoice.edit',
  'sales.invoice.view',
  'sales.order.create',
  'sales.order.edit',
  'sales.order.view',
  'sales.quotation.create',
  'sales.quotation.edit',
  'sales.quotation.view',
  'sales.return.create',
  'sales.return.view',
  'settings.manage',
  'users.audit.view',
  'users.role.create',
  'users.role.delete',
  'users.role.edit',
  'users.role.view',
  'users.user.create',
  'users.user.delete',
  'users.user.edit',
  'users.user.view',
  'warranty.claim.create',
  'warranty.claim.edit',
  'warranty.claim.view',
  'web.order.view',
];
// Har module/resource ke sab common actions (sirf mock Super Admin: demo aur e2e ke liye).
const ACTIONS = [
  'view', 'create', 'edit', 'delete', 'approve', 'reject', 'dispatch', 'receive', 'cancel',
  'send', 'convert', 'post', 'void', 'print', 'reprint', 'export', 'close',
];
const ACTION_KEYS = [
  ...new Set(
    [...flattenMenu().map((i) => i.permission), ...EXTRA_KEYS].map((k) => k.split('.').slice(0, -1).join('.')),
  ),
]
  .filter((prefix) => prefix.includes('.'))
  .flatMap((prefix) => ACTIONS.map((a) => `${prefix}.${a}`));
const ALL_KEYS = [...new Set([...flattenMenu().map((i) => i.permission), ...CRUD_KEYS, ...LABEL_KEYS, ...PURCHASE_KEYS, ...EXTRA_KEYS, ...ACTION_KEYS])];
const BRANCHES: Branch[] = [
  { id: 1, name: 'Karachi Main' },
  { id: 2, name: 'Lahore' },
];

const USERS: MockUser[] = [
  {
    email: 'super@demo.test', id: 1, name: 'Demo Super Admin', role: 'super_admin', type: 'super_admin',
    twoFactor: true, keys: ALL_KEYS, branches: BRANCHES, limits: null,
  },
  {
    email: 'admin@demo.test', id: 2, name: 'Demo Admin', role: 'admin', type: 'admin',
    twoFactor: true, keys: ALL_KEYS.filter((k) => k !== 'settings.manage'), branches: BRANCHES,
    limits: { discountPercent: 5, adjustmentUnits: 10, maxSaleWithoutApproval: 500000 },
  },
  {
    email: 'keeper@demo.test', id: 3, name: 'Demo Store Keeper', role: 'store_keeper', type: 'staff',
    twoFactor: false,
    keys: [
      'dashboard.view.view', 'inventory.stock.view', 'inventory.serial.view',
      'inventory.location.view', 'inventory.transfer.view', 'inventory.count.view',
    ],
    branches: [BRANCHES[0]],
    limits: { discountPercent: 2, adjustmentUnits: 3, maxSaleWithoutApproval: 100000 },
  },
];

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch {
    // storage available nahi, mock session sirf is page tak
  }
}

function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  return `${name.slice(0, 2)}***@${domain}`;
}

const find = (email: string | null): MockUser | undefined => USERS.find((u) => u.email === email);
const grant = (key: string) => ({ key, scope: 'all', expiresAt: null, limit: null });

function meFor(u: MockUser) {
  return {
    user: { id: u.id, name: u.name, role: u.role, isSuperAdmin: u.type === 'super_admin', type: u.type },
    permissions: u.keys.map(grant),
    branches: u.branches,
    activeBranchId: u.branches[0]?.id ?? null,
    limits: u.limits,
    locale: 'en',
  };
}

export const AUTH_FIXTURES: Record<string, FixtureHandler> = {
  'GET /sanctum/csrf-cookie': () => ok(),
  'POST /auth/login': (req) => {
    const b = req.body as { email?: string; password?: string } | null;
    const user = find(b?.email?.trim().toLowerCase() ?? null);
    if (!user || !b?.password) return fail(422, 'These credentials do not match our records.');
    if (user.twoFactor) {
      write(PENDING_KEY, user.email);
      return ok({ twoFactorRequired: true, method: 'email', maskedEmail: maskEmail(user.email), resendAfterSeconds: 60 });
    }
    write(SESSION_KEY, user.email);
    return ok({ twoFactorRequired: false });
  },
  'POST /auth/two-factor': (req) => {
    const pending = read(PENDING_KEY);
    if (!pending) return fail(401, 'Login expired.');
    const code = (req.body as { code?: string } | null)?.code;
    if (code !== VALID_CODE) return fail(422, 'The code is invalid.');
    write(PENDING_KEY, null);
    write(SESSION_KEY, pending);
    return ok();
  },
  'POST /auth/two-factor/resend': () =>
    read(PENDING_KEY) ? ok({ resendAfterSeconds: 60 }) : fail(401, 'Login expired.'),
  'POST /auth/logout': () => {
    write(SESSION_KEY, null);
    write(PENDING_KEY, null);
    return ok();
  },
  'GET /me': () => {
    const user = find(read(SESSION_KEY));
    return user ? ok(meFor(user)) : fail(401, 'Unauthenticated.');
  },
};
