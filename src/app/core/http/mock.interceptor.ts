import { HttpErrorResponse, HttpEvent, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { FIXTURES } from '../mock/fixtures';
import { MockModeService } from '../mock/mock-mode.service';

const MOCKED_PREFIXES = [APP_CONFIG.apiBase, '/sanctum'];

// 'GET /products/:id' jaisi keys ko /products/5 se match karta hai
function matchIdRoute(method: string, path: string) {
  const key = Object.keys(FIXTURES).find((k) => {
    const [m, pattern] = k.split(' ');
    if (m !== method || !pattern.includes(':id')) return false;
    return new RegExp('^' + pattern.replace(':id', '[^/]+') + '$').test(path);
  });
  return key ? FIXTURES[key] : undefined;
}

export const mockInterceptor: HttpInterceptorFn = (req, next) => {
  const mocked = MOCKED_PREFIXES.some((p) => req.url.startsWith(p));
  if (!inject(MockModeService).enabled() || !mocked) {
    return next(req);
  }
  const raw = req.url.startsWith(APP_CONFIG.apiBase) ? req.url.slice(APP_CONFIG.apiBase.length) : req.url;
  const path = raw.split('?')[0];
  const handler = FIXTURES[`${req.method} ${path}`] ?? matchIdRoute(req.method, path);
  if (!handler) return next(req);

  const res = handler({ method: req.method, url: req.url, body: req.body });
  const out$: Observable<HttpEvent<unknown>> =
    res.status >= 400
      ? throwError(() => new HttpErrorResponse({ status: res.status, error: res.body, url: req.url }))
      : of(new HttpResponse({ status: res.status, body: res.body }));
  return out$.pipe(delay(200));
};
