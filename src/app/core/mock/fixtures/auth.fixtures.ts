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

const ALL_KEYS = [...new Set(flattenMenu().map((i) => i.permission))];
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
      return ok({ twoFactorRequired: true });
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