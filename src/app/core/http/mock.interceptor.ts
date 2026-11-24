import { HttpErrorResponse, HttpEvent, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, delay, from, of, switchMap, throwError } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import type { FixtureHandler } from '../mock/fixtures/fixture.types';
import { MockModeService } from '../mock/mock-mode.service';

const MOCKED_PREFIXES = [APP_CONFIG.apiBase, '/sanctum'];

type Fixtures = Record<string, FixtureHandler>;

// Fixtures alag chunk mein hain: pehli mock request par hi load hote hain, main bundle mein nahi.
let fixtures: Promise<Fixtures> | null = null;
const loadFixtures = (): Promise<Fixtures> =>
  (fixtures ??= import('../mock/fixtures').then((m) => m.FIXTURES));

// 'GET /products/:id' jaisi keys ko /products/5 se match karta hai
function matchIdRoute(all: Fixtures, method: string, path: string): FixtureHandler | undefined {
  const key = Object.keys(all).find((k) => {
    const [m, pattern] = k.split(' ');
    if (m !== method || !pattern.includes(':id')) return false;
    return new RegExp('^' + pattern.replace(':id', '[^/]+') + '$').test(path);
  });
  return key ? all[key] : undefined;
}

// Asal API ki tarah har jawab nayi copy ho. Warna mock ka data badalte hi page ka apna object
// bhi (jawab aane se pehle) badal jata hai aur UI/tests aage nikal jate hain.
function cloneBody<T>(body: T): T {
  try {
    return structuredClone(body);
  } catch {
    return body;
  }
}

export const mockInterceptor: HttpInterceptorFn = (req, next) => {
  const mocked = MOCKED_PREFIXES.some((p) => req.url.startsWith(p));
  if (!inject(MockModeService).enabled() || !mocked) {
    return next(req);
  }
  // Browser offline ho to mock bhi asli network jaisa fail kare (offline queue ke test ke liye).
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return throwError(() => new HttpErrorResponse({ status: 0, url: req.url }));
  }
  const raw = req.url.startsWith(APP_CONFIG.apiBase) ? req.url.slice(APP_CONFIG.apiBase.length) : req.url;
  const path = raw.split('?')[0];

  return from(loadFixtures()).pipe(
    switchMap((all): Observable<HttpEvent<unknown>> => {
      const handler = all[`${req.method} ${path}`] ?? matchIdRoute(all, req.method, path);
      if (!handler) return next(req);

      const res = handler({ method: req.method, url: req.url, body: req.body });
      const out$: Observable<HttpEvent<unknown>> =
        res.status >= 400
          ? throwError(() => new HttpErrorResponse({ status: res.status, error: cloneBody(res.body), url: req.url }))
          : of(new HttpResponse({ status: res.status, body: cloneBody(res.body) }));
      return out$.pipe(delay(200));
    }),
  );
};