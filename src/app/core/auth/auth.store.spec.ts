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
};

describe('AuthStore', () => {
  const authMock = { me: vi.fn(), login: vi.fn(), logout: vi.fn() };

  beforeEach(() => {
    authMock.me.mockReset();
    authMock.login.mockReset();
    authMock.logout.mockReset();
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

  it('login: kamyab login ke baad true', async () => {
    authMock.login.mockReturnValue(of(undefined));
    authMock.me.mockReturnValue(of(me));
    const store = TestBed.inject(AuthStore);
    const okLogin = await store.login({ email: 'a@b.c', password: 'secret' });
    expect(okLogin).toBe(true);
  });

  it('logout: state saaf ho jati hai', async () => {
    authMock.me.mockReturnValue(of(me));
    authMock.logout.mockReturnValue(of(undefined));
    const store = TestBed.inject(AuthStore);
    await store.load();
    await store.logout();
    expect(store.status()).toBe('anonymous');
    expect(store.user()).toBeNull();
  });
});