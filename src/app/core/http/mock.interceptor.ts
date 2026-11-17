import { HttpErrorResponse, HttpEvent, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, delay, of, throwError } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { FIXTURES } from '../mock/fixtures';
import { MockModeService } from '../mock/mock-mode.service';

const MOCKED_PREFIXES = [APP_CONFIG.apiBase, '/sanctum'];

export const mockInterceptor: HttpInterceptorFn = (req, next) => {
  const mocked = MOCKED_PREFIXES.some((p) => req.url.startsWith(p));
  if (!inject(MockModeService).enabled() || !mocked) {
    return next(req);
  }
  const raw = req.url.startsWith(APP_CONFIG.apiBase) ? req.url.slice(APP_CONFIG.apiBase.length) : req.url;
  const handler = FIXTURES[`${req.method} ${raw.split('?')[0]}`];
  if (!handler) return next(req);

  const res = handler({ method: req.method, url: req.url, body: req.body });
  const out$: Observable<HttpEvent<unknown>> =
    res.status >= 400
      ? throwError(() => new HttpErrorResponse({ status: res.status, error: res.body, url: req.url }))
      : of(new HttpResponse({ status: res.status, body: res.body }));
  return out$.pipe(delay(200));
};