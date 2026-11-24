import { ROLE_TEMPLATES } from '../../../features/users/permission-registry';
import { UserType } from '../../auth/auth.models';
import { ManagedUser, UserBody } from '../../../features/users/models/users.models';
import { canManageUser, creatableTypes } from '../../../features/users/users.rules';
import { FixtureHandler, fail, ok } from './fixture.types';

interface MockRole {
  id: number;
  name: string;
  description: string;
  permissions: string[];
  isSystem: boolean;
}

export const ROLES: MockRole[] = ROLE_TEMPLATES.map((t, i) => ({
  id: i + 1,
  name: t.name,
  description: t.description,
  permissions: [...t.permissions],
  isSystem: false,
}));

export const users: ManagedUser[] = [
  { id: 1, name: 'Demo Super Admin', email: 'super@demo.test', type: 'super_admin', roleId: null, roleName: null, branchIds: [1, 2], isActive: true, accessExpiresAt: null, discountPercent: null, adjustmentUnits: null },
  { id: 2, name: 'Demo Admin', email: 'admin@demo.test', type: 'admin', roleId: 4, roleName: 'Branch Manager', branchIds: [1, 2], isActive: true, accessExpiresAt: null, discountPercent: 5, adjustmentUnits: 10 },
  { id: 3, name: 'Demo Store Keeper', email: 'keeper@demo.test', type: 'staff', roleId: 1, roleName: 'Store Keeper', branchIds: [1], isActive: true, accessExpiresAt: null, discountPercent: 2, adjustmentUnits: 3 },
  { id: 4, name: 'Sana Sales', email: 'sana@demo.test', type: 'staff', roleId: 2, roleName: 'Sales Executive', branchIds: [1], isActive: true, accessExpiresAt: null, discountPercent: 5, adjustmentUnits: 0 },
  { id: 5, name: 'Bilal Accounts', email: 'bilal@demo.test', type: 'staff', roleId: 3, roleName: 'Accountant', branchIds: [2], isActive: true, accessExpiresAt: '2027-03-31', discountPercent: 0, adjustmentUnits: 0 },
  { id: 6, name: 'Hira Lahore', email: 'hira@demo.test', type: 'staff', roleId: 2, roleName: 'Sales Executive', branchIds: [2], isActive: false, accessExpiresAt: null, discountPercent: 5, adjustmentUnits: 2 },
];

const LAST_SUPER = 'The last SuperAdmin cannot be removed or disabled.';
const EMAIL_TYPE: Record<string, UserType> = {
  'super@demo.test': 'super_admin',
  'admin@demo.test': 'admin',
  'keeper@demo.test': 'staff',
};

/** Mock login session se pata karta hai ke kaun request kar raha hai (asli backend session se karega). */
export function actorType(): UserType | null {
  try {
    return EMAIL_TYPE[sessionStorage.getItem('erp.mock.session') ?? ''] ?? null;
  } catch {
    return null;
  }
}

const idOf = (url: string): number => {
  const parts = url.split('?')[0].split('/');
  return Number(parts[parts.indexOf('users') + 1]);
};
const nextId = (): number => Math.max(0, ...users.map((u) => u.id)) + 1;
const roleName = (id: number | null): string | null => ROLES.find((r) => r.id === id)?.name ?? null;
const omitPw = <T extends object>(b: T): Omit<T, 'password'> => {
  const c = { ...b } as Record<string, unknown>;
  delete c['password'];
  return c as Omit<T, 'password'>;
};
const emailTaken = (email: string, ignoreId: number): boolean =>
  users.some((u) => u.id !== ignoreId && u.email.toLowerCase() === email.trim().toLowerCase());
const supers = (): ManagedUser[] => users.filter((u) => u.type === 'super_admin');
const isLastSuper = (u: ManagedUser): boolean =>
  u.type === 'super_admin' &&
  (supers().length <= 1 || (u.isActive && supers().filter((s) => s.isActive).length <= 1));
const forbidden = () => fail(403, 'You are not allowed to manage this user.');

function find(url: string): ManagedUser | undefined {
  const id = idOf(url);
  return users.find((u) => u.id === id);
}

export const USER_FIXTURES: Record<string, FixtureHandler> = {
  'GET /users': (req) => {
    const q = new URL(req.url, 'http://mock').searchParams;
    const actor = actorType();
    let rows = users.filter((u) => (actor === 'admin' ? u.type === 'staff' : true));

    const type = q.get('type');
    const roleId = q.get('roleId');
    const branchId = q.get('branchId');
    const status = q.get('status');
    const search = (q.get('search') ?? '').trim().toLowerCase();
    if (type) rows = rows.filter((u) => u.type === type);
    if (roleId) rows = rows.filter((u) => String(u.roleId) === roleId);
    if (branchId) rows = rows.filter((u) => u.branchIds.includes(Number(branchId)));
    if (status) rows = rows.filter((u) => u.isActive === (status === 'active'));
    if (search) rows = rows.filter((u) => `${u.name} ${u.email}`.toLowerCase().includes(search));

    const [field, dir] = (q.get('sort') ?? '').split(':');
    if (field) {
      rows = [...rows].sort((a, b) => {
        const x = String((a as unknown as Record<string, unknown>)[field] ?? '');
        const y = String((b as unknown as Record<string, unknown>)[field] ?? '');
        return dir === 'desc' ? y.localeCompare(x) : x.localeCompare(y);
      });
    }
    const page = Number(q.get('page') ?? 1);
    const pageSize = Number(q.get('pageSize') ?? 10);
    return ok({ data: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length });
  },

  'POST /users': (req) => {
    const b = req.body as UserBody;
    if (!creatableTypes(actorType()).includes(b.type)) {
      return fail(403, 'You are not allowed to create this user type.');
    }
    if (emailTaken(b.email, 0)) return fail(422, 'This email is already used.');
    if (!b.password || b.password.length < 8) return fail(422, 'Password must be at least 8 characters.');
    const row: ManagedUser = { ...omitPw(b), email: b.email.trim().toLowerCase(), id: nextId(), roleName: roleName(b.roleId) };
    users.push(row);
    return ok(row);
  },

  'PUT /users/:id': (req) => {
    const row = find(req.url);
    if (!row) return fail(404, 'Not found.');
    const actor = actorType();
    if (!canManageUser(actor, row.type)) return forbidden();
    const b = req.body as UserBody;
    if (b.isActive === false && isLastSuper(row)) return fail(409, LAST_SUPER);
    if (emailTaken(b.email, row.id)) return fail(422, 'This email is already used.');
    const type = row.type === 'super_admin' ? 'super_admin' : b.type;
    if (type !== row.type && !creatableTypes(actor).includes(type)) return forbidden();
    Object.assign(row, { ...omitPw(b), type, email: b.email.trim().toLowerCase(), roleName: roleName(b.roleId) });
    return ok(row);
  },

  'DELETE /users/:id': (req) => {
    const row = find(req.url);
    if (!row) return fail(404, 'Not found.');
    if (!canManageUser(actorType(), row.type)) return forbidden();
    if (isLastSuper(row)) return fail(409, LAST_SUPER);
    users.splice(users.indexOf(row), 1);
    return ok();
  },

  'POST /users/:id/active': (req) => {
    const row = find(req.url);
    if (!row) return fail(404, 'Not found.');
    if (!canManageUser(actorType(), row.type)) return forbidden();
    const isActive = (req.body as { isActive?: boolean } | null)?.isActive === true;
    if (!isActive && isLastSuper(row)) return fail(409, LAST_SUPER);
    row.isActive = isActive;
    return ok(row);
  },

  'POST /users/:id/force-logout': (req) => {
    const row = find(req.url);
    if (!row) return fail(404, 'Not found.');
    return canManageUser(actorType(), row.type) ? ok() : forbidden();
  },

  'POST /users/:id/reset-password': (req) => {
    const row = find(req.url);
    if (!row) return fail(404, 'Not found.');
    return canManageUser(actorType(), row.type) ? ok() : forbidden();
  },

  'GET /roles': (req) => {
    const q = new URL(req.url, 'http://mock').searchParams;
    const search = (q.get('search') ?? '').trim().toLowerCase();
    const data = ROLES.filter((r) => r.name.toLowerCase().includes(search));
    return ok({ data, total: data.length });
  },
};

// ---------- roles ----------
const roleIdOf = (url: string): number => {
  const parts = url.split('?')[0].split('/');
  return Number(parts[parts.indexOf('roles') + 1]);
};
const roleAccess = (): boolean => {
  const a = actorType();
  return a === 'super_admin' || a === 'admin';
};
const roleNameTaken = (name: string, ignoreId: number): boolean =>
  ROLES.some((r) => r.id !== ignoreId && r.name.toLowerCase() === name.trim().toLowerCase());
const userCountOf = (id: number): number => users.filter((u) => u.roleId === id).length;
const roleItem = (r: MockRole) => ({
  id: r.id,
  name: r.name,
  description: r.description,
  permissionCount: r.permissions.length,
  userCount: userCountOf(r.id),
  isSystem: r.isSystem,
});
const NO_ROLE_ACCESS = 'You are not allowed to manage roles.';

export const ROLE_FIXTURES: Record<string, FixtureHandler> = {
  'GET /roles': (req) => {
    if (!roleAccess()) return fail(403, NO_ROLE_ACCESS);
    const q = new URL(req.url, 'http://mock').searchParams;
    const search = (q.get('search') ?? '').trim().toLowerCase();
    let rows = ROLES.filter((r) => r.name.toLowerCase().includes(search)).map(roleItem);
    const [field, dir] = (q.get('sort') ?? '').split(':');
    if (field) {
      rows = [...rows].sort((a, b) => {
        const x = (a as unknown as Record<string, string | number>)[field];
        const y = (b as unknown as Record<string, string | number>)[field];
        const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
        return dir === 'desc' ? -c : c;
      });
    }
    const page = Number(q.get('page') ?? 1);
    const pageSize = Number(q.get('pageSize') ?? 10);
    return ok({ data: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length });
  },

  'GET /roles/:id': (req) => {
    if (!roleAccess()) return fail(403, NO_ROLE_ACCESS);
    const r = ROLES.find((x) => x.id === roleIdOf(req.url));
    return r ? ok({ ...r, userCount: userCountOf(r.id) }) : fail(404, 'Not found.');
  },

  'POST /roles': (req) => {
    if (!roleAccess()) return fail(403, NO_ROLE_ACCESS);
    const b = req.body as { name: string; description: string; permissions: string[] };
    if (roleNameTaken(b.name, 0)) return fail(422, 'This role name already exists.');
    const role: MockRole = {
      id: Math.max(0, ...ROLES.map((r) => r.id)) + 1,
      name: b.name.trim(),
      description: b.description,
      permissions: b.permissions,
      isSystem: false,
    };
    ROLES.push(role);
    return ok(roleItem(role));
  },

  'PUT /roles/:id': (req) => {
    if (!roleAccess()) return fail(403, NO_ROLE_ACCESS);
    const role = ROLES.find((x) => x.id === roleIdOf(req.url));
    if (!role) return fail(404, 'Not found.');
    const b = req.body as { name: string; description: string; permissions: string[] };
    if (roleNameTaken(b.name, role.id)) return fail(422, 'This role name already exists.');
    Object.assign(role, { name: b.name.trim(), description: b.description, permissions: b.permissions });
    users.filter((u) => u.roleId === role.id).forEach((u) => (u.roleName = role.name));
    return ok(roleItem(role));
  },

  'DELETE /roles/:id': (req) => {
    if (!roleAccess()) return fail(403, NO_ROLE_ACCESS);
    const role = ROLES.find((x) => x.id === roleIdOf(req.url));
    if (!role) return fail(404, 'Not found.');
    if (role.isSystem) return fail(409, 'A system role cannot be deleted.');
    if (userCountOf(role.id) > 0) return fail(409, 'This role is assigned to users and cannot be deleted.');
    ROLES.splice(ROLES.indexOf(role), 1);
    return ok();
  },
};