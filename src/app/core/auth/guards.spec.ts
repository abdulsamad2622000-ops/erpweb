import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { AuthStore } from './auth.store';
import { authGuard, guestGuard, permissionGuard } from './guards';

function setup(opts: { authenticated: boolean; allowed?: string[] }) {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: AuthStore,
        useValue: {
          ensureLoaded: () => Promise.resolve(),
          isAuthenticated: () => opts.authenticated,
          can: (k: string) => (opts.allowed ?? []).includes(k),
        },
      },
    ],
  });
  return TestBed.inject(Router);
}

const route = (permission?: string) =>
  ({ data: permission ? { permission } : {} }) as unknown as ActivatedRouteSnapshot;
const state = { url: '/inventory/stock' } as RouterStateSnapshot;

describe('guards', () => {
  it('authGuard: login nahi to /login?returnUrl', async () => {
    const router = setup({ authenticated: false });
    const res = await TestBed.runInInjectionContext(() => authGuard(route(), state));
    expect(router.serializeUrl(res as UrlTree)).toBe('/login?returnUrl=%2Finventory%2Fstock');
  });

  it('authGuard: login hai to true', async () => {
    setup({ authenticated: true });
    expect(await TestBed.runInInjectionContext(() => authGuard(route(), state))).toBe(true);
  });

  it('guestGuard: logged-in user dashboard par', async () => {
    const router = setup({ authenticated: true });
    const res = await TestBed.runInInjectionContext(() => guestGuard(route(), state));
    expect(router.serializeUrl(res as UrlTree)).toBe('/dashboard');
  });

  it('guestGuard: guest ko jaane deta hai', async () => {
    setup({ authenticated: false });
    expect(await TestBed.runInInjectionContext(() => guestGuard(route(), state))).toBe(true);
  });

  it('permissionGuard: permission hai to true', () => {
    setup({ authenticated: true, allowed: ['a.b.view'] });
    expect(TestBed.runInInjectionContext(() => permissionGuard(route('a.b.view'), state))).toBe(true);
  });

  it('permissionGuard: permission nahi to /403', () => {
    const router = setup({ authenticated: true, allowed: [] });
    const res = TestBed.runInInjectionContext(() => permissionGuard(route('a.b.view'), state));
    expect(router.serializeUrl(res as UrlTree)).toBe('/403');
  });

  it('permissionGuard: route par key nahi to true', () => {
    setup({ authenticated: true });
    expect(TestBed.runInInjectionContext(() => permissionGuard(route(), state))).toBe(true);
  });
});