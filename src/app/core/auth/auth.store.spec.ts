import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { MeResponse } from './auth.models';
import { AuthService } from './auth.service';
import { AuthStore } from './auth.store';

const me: MeResponse = {
  user: { id: 1, name: 'Test', role: 'staff', isSuperAdmin: false },
  permissions: [
    { key: 'inventory.stock.view', scope: 'all', expiresAt: null, limit: null },
    { key: 'old.thing.view', scope: 'all', expiresAt: '2000-01-01T00:00:00Z', limit: null },
  ],
  branches: [
    { id: 1, name: 'A' },
    { id: 2, name: 'B' },
  ],
  activeBranchId: 1,
};

describe('AuthStore', () => {
  const authMock = { me: vi.fn(), login: vi.fn(), logout: vi.fn(), twoFactor: vi.fn() };

  beforeEach(() => {
    Object.values(authMock).forEach((m) => m.mockReset());
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: authMock }] });
  });

  it('load: authenticated hota hai aur expired permission ignore hoti hai', async () => {
    authMock.me.mockReturnValue(of(me));
    const store = TestBed.inject(AuthStore);
    await store.load();
    expect(store.status()).toBe('authenticated');
    expect(store.can('inventory.stock.view')).toBe(true);
    expect(store.can('old.thing.view')).toBe(false);
    expect(store.can('x.y.z')).toBe(false);
  });

  it('load: 401 par anonymous', async () => {
    authMock.me.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 401 })));
    const store = TestBed.inject(AuthStore);
    await store.load();
    expect(store.status()).toBe('anonymous');
    expect(store.can('inventory.stock.view')).toBe(false);
  });

  it('login: 2FA ke baghair seedha authenticated', async () => {
    authMock.login.mockReturnValue(of({ twoFactorRequired: false }));
    authMock.me.mockReturnValue(of(me));
    const store = TestBed.inject(AuthStore);
    expect(await store.login({ email: 'a@b.c', password: 'secret' })).toBe('authenticated');
  });

  it('login: 2FA zaroori ho to two_factor aur /me abhi nahi', async () => {
    authMock.login.mockReturnValue(of({ twoFactorRequired: true }));
    const store = TestBed.inject(AuthStore);
    expect(await store.login({ email: 'a@b.c', password: 'secret' })).toBe('two_factor');
    expect(authMock.me).not.toHaveBeenCalled();
    expect(store.isAuthenticated()).toBe(false);
  });

  it('verifyTwoFactor: code ke baad authenticated', async () => {
    authMock.twoFactor.mockReturnValue(of(undefined));
    authMock.me.mockReturnValue(of(me));
    const store = TestBed.inject(AuthStore);
    expect(await store.verifyTwoFactor('123456')).toBe('authenticated');
  });

  it('logout: state saaf ho jati hai', async () => {
    authMock.me.mockReturnValue(of(me));
    authMock.logout.mockReturnValue(of(undefined));
    const store = TestBed.inject(AuthStore);
    await store.load();
    await store.logout();
    expect(store.status()).toBe('anonymous');
    expect(store.user()).toBeNull();
    expect(store.branches()).toEqual([]);
  });

  it('branch: /me ki active branch, phir switch aur save', async () => {
    authMock.me.mockReturnValue(of(me));
    const store = TestBed.inject(AuthStore);
    await store.load();
    expect(store.activeBranchId()).toBe(1);
    store.setActiveBranch(2);
    expect(store.activeBranchId()).toBe(2);
    expect(store.activeBranch()?.name).toBe('B');
    expect(localStorage.getItem('erp.branch')).toBe('2');
  });

  it('branch: ghalat id ignore hoti hai', async () => {
    authMock.me.mockReturnValue(of(me));
    const store = TestBed.inject(AuthStore);
    await store.load();
    store.setActiveBranch(99);
    expect(store.activeBranchId()).toBe(1);
  });

  it('branch: pichli saved choice restore hoti hai', async () => {
    localStorage.setItem('erp.branch', '2');
    authMock.me.mockReturnValue(of(me));
    const store = TestBed.inject(AuthStore);
    await store.load();
    expect(store.activeBranchId()).toBe(2);
  });
});