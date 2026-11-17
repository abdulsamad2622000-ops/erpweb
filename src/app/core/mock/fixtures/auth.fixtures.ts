import { flattenMenu } from '../../nav/menu.config';
import { FixtureHandler, fail, ok } from './fixture.types';

// Mock login: staff@demo.test = limited staff, baaki koi bhi email = super admin. Password koi bhi.
const SESSION_KEY = 'erp.mock.session';
const STAFF_EMAIL = 'staff@demo.test';

function readSession(): string | null {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function writeSession(value: string | null): void {
  try {
    if (value) sessionStorage.setItem(SESSION_KEY, value);
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // storage available nahi, mock session sirf is page tak
  }
}

const grant = (key: string) => ({ key, scope: 'all', expiresAt: null, limit: null });

function meFor(email: string) {
  if (email === STAFF_EMAIL) {
    return {
      user: { id: 2, name: 'Demo Staff', role: 'staff', isSuperAdmin: false },
      permissions: ['dashboard.view.view', 'inventory.stock.view', 'inventory.serial.view'].map(grant),
    };
  }
  const keys = [...new Set(flattenMenu().map((i) => i.permission))];
  return {
    user: { id: 1, name: 'Demo Super Admin', role: 'super_admin', isSuperAdmin: true },
    permissions: keys.map(grant),
  };
}

export const AUTH_FIXTURES: Record<string, FixtureHandler> = {
  'GET /sanctum/csrf-cookie': () => ok(),
  'POST /auth/login': (req) => {
    const b = req.body as { email?: string; password?: string } | null;
    if (!b?.email || !b.password) return fail(422, 'The given data was invalid.');
    writeSession(b.email.trim().toLowerCase());
    return ok();
  },
  'POST /auth/logout': () => {
    writeSession(null);
    return ok();
  },
  'GET /me': () => {
    const email = readSession();
    return email ? ok(meFor(email)) : fail(401, 'Unauthenticated.');
  },
};