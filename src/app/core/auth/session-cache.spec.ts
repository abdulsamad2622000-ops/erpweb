import { beforeEach, describe, expect, it } from 'vitest';
import { SESSION_MAX_AGE_MS, clearSession, readSession, saveSession } from './session-cache';

const snap = {
  user: { id: 1, name: 'Test', role: 'staff', isSuperAdmin: false },
  permissions: [{ key: 'inventory.count.create', scope: 'all', expiresAt: null, limit: null }],
  branches: [{ id: 1, name: 'A' }],
  activeBranchId: 1,
  limits: null,
};

describe('session cache', () => {
  beforeEach(() => localStorage.clear());

  it('saves and reads the last session', () => {
    saveSession(snap, 1000);
    const s = readSession(2000);
    expect(s?.user.name).toBe('Test');
    expect(s?.permissions[0].key).toBe('inventory.count.create');
    expect(s?.activeBranchId).toBe(1);
  });

  it('ignores a session older than 7 days', () => {
    saveSession(snap, 1000);
    expect(readSession(1000 + SESSION_MAX_AGE_MS + 1)).toBeNull();
  });

  it('ignores broken data and can be cleared', () => {
    localStorage.setItem('erp.session', '{not json');
    expect(readSession()).toBeNull();
    localStorage.setItem('erp.session', JSON.stringify({ user: null }));
    expect(readSession()).toBeNull();
    saveSession(snap);
    clearSession();
    expect(readSession()).toBeNull();
  });
});