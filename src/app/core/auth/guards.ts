import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from './auth.store';

/** Login ke baghair andar nahi. Baad mein wapsi ke liye returnUrl bhejta hai. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const store = inject(AuthStore);
  const router = inject(Router);
  await store.ensureLoaded();
  return store.isAuthenticated()
    ? true
    : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Login/forgot pages sirf logged-out users ke liye. */
export const guestGuard: CanActivateFn = async () => {
  const store = inject(AuthStore);
  const router = inject(Router);
  await store.ensureLoaded();
  return store.isAuthenticated() ? router.createUrlTree(['/dashboard']) : true;
};

/** Route ke data.permission ki key chahiye. authGuard ke baad lagao. */
export const permissionGuard: CanActivateFn = (route) => {
  const store = inject(AuthStore);
  const router = inject(Router);
  const key = route.data['permission'] as string | undefined;
  if (!key) return true;
  return store.can(key) ? true : router.createUrlTree(['/403']);
};