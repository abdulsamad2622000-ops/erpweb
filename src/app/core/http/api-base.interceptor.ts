import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Relative /api/... ko same-origin rakhta hai (cookies ke saath).
 * X-Client header se backend frontend-contract wala jawab deta hai (jahan purana format bhi chalta ho).
 */
export const apiBaseInterceptor: HttpInterceptorFn = (req, next) =>
  req.url.startsWith('/api')
    ? next(req.clone({ withCredentials: true, setHeaders: { 'X-Client': 'erp-web' } }))
    : next(req);
