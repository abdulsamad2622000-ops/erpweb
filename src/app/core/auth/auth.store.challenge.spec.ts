import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MeResponse } from './auth.models';
import { AuthService } from './auth.service';
import { AuthStore } from './auth.store';

const me: MeResponse = {
  user: { id: 1, name: 'T', role: 'admin', isSuperAdmin: false },
  permissions: [],
};

describe('AuthStore email OTP', () => {
  const authMock = { me: vi.fn(), login: vi.fn(), logout: vi.fn(), twoFactor: vi.fn(), resendTwoFactor: vi.fn() };

  beforeEach(() => {
    Object.values(authMock).forEach((m) => m.mockReset());
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: AuthService, useValue: authMock }] });
  });

  it('login: masked email aur resend seconds challenge mein aate hain', async () => {
    authMock.login.mockReturnValue(
      of({ twoFactorRequired: true, method: 'email', maskedEmail: 'su***@demo.test', resendAfterSeconds: 45 }),
    );
    const store = TestBed.inject(AuthStore);
    expect(await store.login({ email: 'a@b.c', password: 'x' })).toBe('two_factor');
    expect(store.challenge()).toEqual({ method: 'email', maskedEmail: 'su***@demo.test', resendAfterSeconds: 45 });
  });

  it('resend: naye seconds wapas aate hain aur challenge update hota hai', async () => {
    authMock.login.mockReturnValue(of({ twoFactorRequired: true, maskedEmail: 'a***@b.c' }));
    authMock.resendTwoFactor.mockReturnValue(of({ resendAfterSeconds: 90 }));
    const store = TestBed.inject(AuthStore);
    await store.login({ email: 'a@b.c', password: 'x' });
    expect(await store.resendTwoFactor()).toBe(90);
    expect(store.challenge()?.resendAfterSeconds).toBe(90);
  });

  it('verify ke baad challenge saaf ho jata hai', async () => {
    authMock.login.mockReturnValue(of({ twoFactorRequired: true, maskedEmail: 'a***@b.c' }));
    authMock.twoFactor.mockReturnValue(of(undefined));
    authMock.me.mockReturnValue(of(me));
    const store = TestBed.inject(AuthStore);
    await store.login({ email: 'a@b.c', password: 'x' });
    expect(await store.verifyTwoFactor('123456')).toBe('authenticated');
    expect(store.challenge()).toBeNull();
  });
});