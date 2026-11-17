import { HttpInterceptorFn } from '@angular/common/http';

// Relative /api/... ko same-origin rakhta hai; alag backend host ho to yahan lagega
export const apiBaseInterceptor: HttpInterceptorFn = (req, next) =>
  next(req.clone({ withCredentials: req.url.startsWith('/api') }));