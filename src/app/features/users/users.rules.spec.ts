import { describe, expect, it } from 'vitest';
import { canManageUser, creatableTypes } from './users.rules';

describe('canManageUser', () => {
  it('SuperAdmin sab ko manage karta hai', () => {
    expect(canManageUser('super_admin', 'admin')).toBe(true);
    expect(canManageUser('super_admin', 'staff')).toBe(true);
  });
  it('Admin sirf Staff ko manage karta hai', () => {
    expect(canManageUser('admin', 'staff')).toBe(true);
    expect(canManageUser('admin', 'admin')).toBe(false);
    expect(canManageUser('admin', 'super_admin')).toBe(false);
  });
  it('Staff aur anjaan kisi ko nahi', () => {
    expect(canManageUser('staff', 'staff')).toBe(false);
    expect(canManageUser(null, 'staff')).toBe(false);
  });
});

describe('creatableTypes', () => {
  it('sirf SuperAdmin Admin bana sakta hai', () => {
    expect(creatableTypes('super_admin')).toEqual(['admin', 'staff']);
    expect(creatableTypes('admin')).toEqual(['staff']);
    expect(creatableTypes('staff')).toEqual([]);
  });
});
