import { AuditEntry, OverridesBody } from '../../../features/users/models/permissions.models';
import { ManagedUser } from '../../../features/users/models/users.models';
import { canManageUser } from '../../../features/users/users.rules';
import { FixtureHandler, FixtureRequest, fail, ok } from './fixture.types';
import { ROLES, actorType, users } from './users.fixtures';

// ---------- change log ----------
const AUDIT: AuditEntry[] = [];
let seq = 0;
const ACTOR_NAMES: Record<string, string> = {
  'super@demo.test': 'Demo Super Admin',
  'admin@demo.test': 'Demo Admin',
  'keeper@demo.test': 'Demo Store Keeper',
};

function actorName(): string {
  try {
    return ACTOR_NAMES[sessionStorage.getItem('erp.mock.session') ?? ''] ?? 'System';
  } catch {
    return 'System';
  }
}

function log(action: string, target: string, detail = ''): void {
  AUDIT.unshift({ id: ++seq, at: new Date().toISOString(), actor: actorName(), action, target, detail });
}

const urlId = (url: string, segment: string): number => {
  const parts = url.split('?')[0].split('/');
  return Number(parts[parts.indexOf(segment) + 1]);
};
const userName = (id: number): string => users.find((u) => u.id === id)?.name ?? `#${id}`;
const roleName = (id: number): string => ROLES.find((r) => r.id === id)?.name ?? `#${id}`;
const body = <T>(req: FixtureRequest): T => req.body as T;

type Rule = (req: FixtureRequest) => [string, string, string?];

const RULES: Record<string, Rule> = {
  'POST /users': (r) => ['user.created', body<{ name: string }>(r).name],
  'PUT /users/:id': (r) => ['user.updated', userName(urlId(r.url, 'users'))],
  'DELETE /users/:id': (r) => ['user.deleted', userName(urlId(r.url, 'users'))],
  'POST /users/:id/active': (r) => [
    body<{ isActive?: boolean }>(r).isActive ? 'user.enabled' : 'user.disabled',
    userName(urlId(r.url, 'users')),
  ],
  'POST /users/:id/force-logout': (r) => ['user.forceLogout', userName(urlId(r.url, 'users'))],
  'POST /users/:id/reset-password': (r) => ['user.passwordReset', userName(urlId(r.url, 'users'))],
  'PUT /users/:id/permissions': (r) => {
    const b = body<OverridesBody>(r);
    return ['user.permissions', userName(urlId(r.url, 'users')), `${b.allow.length} allow, ${b.deny.length} deny`];
  },
  'POST /roles': (r) => ['role.created', body<{ name: string }>(r).name],
  'PUT /roles/:id': (r) => [
    'role.updated',
    roleName(urlId(r.url, 'roles')),
    `${body<{ permissions: string[] }>(r).permissions.length} permissions`,
  ],
  'DELETE /roles/:id': (r) => ['role.deleted', roleName(urlId(r.url, 'roles'))],
};

/** Kamyab (status < 400) tabdeeli par change log mein entry likhta hai. */
export function auditWrap(handlers: Record<string, FixtureHandler>): Record<string, FixtureHandler> {
  const out: Record<string, FixtureHandler> = {};
  for (const [key, handler] of Object.entries(handlers)) {
    const rule = RULES[key];
    out[key] = rule
      ? (req) => {
          const entry = rule(req); // naam pehle pakar lete hain (delete ke baad nahi milta)
          const res = handler(req);
          if (res.status < 400) log(...entry);
          return res;
        }
      : handler;
  }
  return out;
}

// ---------- per-user overrides ----------
const overrides = new Map<number, OverridesBody>();
const userOf = (url: string): ManagedUser | undefined => users.find((u) => u.id === urlId(url, 'users'));
const blocked = (u: ManagedUser): boolean => u.type === 'super_admin' || !canManageUser(actorType(), u.type);
const NOT_ALLOWED = 'You are not allowed to manage this user.';

export const OVERRIDE_FIXTURES: Record<string, FixtureHandler> = {
  'GET /users/:id/permissions': (req) => {
    const u = userOf(req.url);
    if (!u) return fail(404, 'Not found.');
    if (blocked(u)) return fail(403, NOT_ALLOWED);
    const o = overrides.get(u.id) ?? { allow: [], deny: [] };
    return ok({
      userId: u.id,
      userName: u.name,
      roleName: u.roleName,
      rolePermissions: ROLES.find((r) => r.id === u.roleId)?.permissions ?? [],
      ...o,
    });
  },

  'PUT /users/:id/permissions': (req) => {
    const u = userOf(req.url);
    if (!u) return fail(404, 'Not found.');
    if (blocked(u)) return fail(403, NOT_ALLOWED);
    const b = body<OverridesBody>(req);
    // Mock mein Admin ke paas sirf settings.manage nahi hota. Asli backend har key check karega.
    if (actorType() === 'admin' && b.allow.includes('settings.manage')) {
      return fail(403, 'You cannot grant a permission you do not hold.');
    }
    overrides.set(u.id, { allow: [...b.allow], deny: [...b.deny] });
    return ok();
  },
};

// ---------- change log list ----------
export const AUDIT_FIXTURES: Record<string, FixtureHandler> = {
  'GET /audit': (req) => {
    const a = actorType();
    if (a !== 'super_admin' && a !== 'admin') return fail(403, 'You are not allowed to view the change log.');
    const q = new URL(req.url, 'http://mock').searchParams;
    const search = (q.get('search') ?? '').trim().toLowerCase();
    let rows = AUDIT.filter((e) => `${e.actor} ${e.action} ${e.target} ${e.detail}`.toLowerCase().includes(search));
    const [field, dir] = (q.get('sort') ?? '').split(':');
    if (field) {
      rows = [...rows].sort((x, y) => {
        const c = String((x as unknown as Record<string, unknown>)[field] ?? '').localeCompare(
          String((y as unknown as Record<string, unknown>)[field] ?? ''),
        );
        return dir === 'desc' ? -c : c;
      });
    }
    const page = Number(q.get('page') ?? 1);
    const pageSize = Number(q.get('pageSize') ?? 10);
    return ok({ data: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length });
  },
};
