import { beforeEach, describe, expect, it } from 'vitest';
import { FixtureHandler, FixtureResponse } from './fixture.types';
import { AUDIT_FIXTURES, OVERRIDE_FIXTURES, auditWrap } from './permissions.fixtures';
import { USER_FIXTURES } from './users.fixtures';

const call = (
  handlers: Record<string, FixtureHandler>,
  key: string,
  url: string,
  body: unknown = null,
): FixtureResponse => handlers[key]({ method: key.split(' ')[0], url, body });

const signIn = (email: string): void => sessionStorage.setItem('erp.mock.session', email);

describe('permission overrides and change log (mock)', () => {
  beforeEach(() => signIn('super@demo.test'));

  it('saves overrides and reads them back with the role permissions', () => {
    const put = call(OVERRIDE_FIXTURES, 'PUT /users/:id/permissions', '/api/v1/users/3/permissions', {
      allow: ['products.product.create'],
      deny: ['inventory.stock.view'],
    });
    expect(put.status).toBe(200);
    const got = call(OVERRIDE_FIXTURES, 'GET /users/:id/permissions', '/api/v1/users/3/permissions')
      .body as { allow: string[]; deny: string[]; rolePermissions: string[] };
    expect(got.allow).toEqual(['products.product.create']);
    expect(got.deny).toEqual(['inventory.stock.view']);
    expect(got.rolePermissions).toContain('inventory.stock.view');
  });

  it('does not allow overrides on a SuperAdmin', () => {
    const res = call(OVERRIDE_FIXTURES, 'GET /users/:id/permissions', '/api/v1/users/1/permissions');
    expect(res.status).toBe(403);
  });

  it('Admin cannot allow a permission he does not hold', () => {
    signIn('admin@demo.test');
    const res = call(OVERRIDE_FIXTURES, 'PUT /users/:id/permissions', '/api/v1/users/3/permissions', {
      allow: ['settings.manage'],
      deny: [],
    });
    expect(res.status).toBe(403);
  });

  it('writes a successful change to the change log', () => {
    const wrapped = auditWrap({ ...USER_FIXTURES });
    expect(call(wrapped, 'POST /users/:id/force-logout', '/api/v1/users/3/force-logout', {}).status).toBe(200);
    const res = call(AUDIT_FIXTURES, 'GET /audit', '/api/v1/audit').body as {
      data: { action: string; target: string; actor: string }[];
    };
    expect(res.data[0]).toMatchObject({
      action: 'user.forceLogout',
      target: 'Demo Store Keeper',
      actor: 'Demo Super Admin',
    });
  });

  it('does not log a change that failed', () => {
    const wrapped = auditWrap({ ...USER_FIXTURES });
    const before = (call(AUDIT_FIXTURES, 'GET /audit', '/api/v1/audit').body as { total: number }).total;
    expect(call(wrapped, 'DELETE /users/:id', '/api/v1/users/1').status).toBe(409);
    const after = (call(AUDIT_FIXTURES, 'GET /audit', '/api/v1/audit').body as { total: number }).total;
    expect(after).toBe(before);
  });
});
