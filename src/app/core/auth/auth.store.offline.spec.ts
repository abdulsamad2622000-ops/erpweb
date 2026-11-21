import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MeResponse } from './auth.models';
import { AuthService } from './auth.service';
import { AuthStore } from './auth.store';

const me: MeResponse = {
  user: { id: 1, name: 'Test', role: 'staff', isSuperAdmin: false },
  permissions: [{ key: 'inventory.count.create', scope: 'all', expiresAt: null, limit: null }],
  branches: [{ id: 1, name: 'A' }],
  activeBranchId: 1,
};

describe('AuthStore offline session', () => {
  const authMock = { me: vi.fn(), logout: vi.fn() };

  const fresh = (): InstanceType<typeof AuthStore> => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: authMock }] });
    return TestBed.inject(AuthStore);
  };

  beforeEach(() => {
    authMock.me.mockReset();
    authMock.logout.mockReset();
    localStorage.clear();
  });

  it('keeps the user signed in when /me fails with no connection after a good load', async () => {
    authMock.me.mockReturnValue(of(me));
    await fresh().load();

    authMock.me.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    const store = fresh();
    await store.load();
    expect(store.status()).toBe('authenticated');
    expect(store.user()?.name).toBe('Test');
    expect(store.can('inventory.count.create')).toBe(true);
  });

  it('a 401 still signs the user out and clears the saved session', async () => {
    authMock.me.mockReturnValue(of(me));
    await fresh().load();

    authMock.me.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    const store = fresh();
    await store.load();
    expect(store.status()).toBe('anonymous');
    expect(localStorage.getItem('erp.session')).toBeNull();
  });

  it('offline with no saved session stays signed out', async () => {
    authMock.me.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    const store = fresh();
    await store.load();
    expect(store.status()).toBe('anonymous');
  });

  it('logout clears the saved session', async () => {
    authMock.me.mockReturnValue(of(me));
    authMock.logout.mockReturnValue(of(undefined));
    const store = fresh();
    await store.load();
    expect(localStorage.getItem('erp.session')).not.toBeNull();
    await store.logout();
    expect(localStorage.getItem('erp.session')).toBeNull();
    expect(store.status()).toBe('anonymous');
  });
});