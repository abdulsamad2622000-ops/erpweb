import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { APP_CONFIG } from '../config/app-config';
import { AuthStore } from '../auth/auth.store';

/** Har API request par active branch ka header. /me aur /auth/* par nahi (branch abhi pata nahi). */
export const branchInterceptor: HttpInterceptorFn = (req, next) => {
  const isApi = req.url.startsWith(APP_CONFIG.apiBase);
  if (!isApi || req.url.endsWith('/me') || req.url.includes('/auth/')) return next(req);
  const id = inject(AuthStore).activeBranchId();
  return id === null ? next(req) : next(req.clone({ setHeaders: { 'X-Branch-Id': String(id) } }));
};