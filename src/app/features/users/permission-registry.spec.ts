import { describe, expect, it } from 'vitest';
import { ROLE_TEMPLATES, allPermissionKeys, grantableKeys } from './permission-registry';

describe('permission registry', () => {
  it('har key unique hai', () => {
    const keys = allPermissionKeys();
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('templates ki har permission registry mein maujood hai', () => {
    const all = new Set(allPermissionKeys());
    for (const t of ROLE_TEMPLATES) {
      for (const k of t.permissions) expect(all.has(k)).toBe(true);
    }
  });

  it('SuperAdmin sab de sakta hai', () => {
    expect(grantableKeys('super_admin', new Set()).size).toBe(allPermissionKeys().length);
  });

  it('Admin sirf wohi de sakta hai jo uske paas hai', () => {
    const g = grantableKeys('admin', new Set(['inventory.stock.view', 'unknown.key']));
    expect([...g]).toEqual(['inventory.stock.view']);
  });
});
