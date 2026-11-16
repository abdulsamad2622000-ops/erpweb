import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { delay, of } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { FIXTURES } from '../mock/fixtures';
import { MockModeService } from '../mock/mock-mode.service';

export const mockInterceptor: HttpInterceptorFn = (req, next) => {
  if (!inject(MockModeService).enabled() || !req.url.startsWith(APP_CONFIG.apiBase)) {
    return next(req);
  }
  const path = req.url.slice(APP_CONFIG.apiBase.length).split('?')[0];
  const handler = FIXTURES[`${req.method} ${path}`];
  if (!handler) return next(req);
  const body = handler({ method: req.method, url: req.url, body: req.body });
  return of(new HttpResponse({ status: 200, body })).pipe(delay(200));
};