import { HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { map } from 'rxjs';

/**
 * Laravel ka jawab frontend contract ki shakal mein:
 * - `{ data: {...} }` (sirf data, object)  -> `{...}`
 * - `{ data: [...] }` (list, total ke baghair) -> `{ data: [...], total: n }`
 * Lists jin mein `total` pehle se ho, waisi hi rehti hain. Mock fixtures par asar nahi (woh pehle hi contract shape hain).
 */
export function unwrapEnvelope(body: unknown): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  const keys = Object.keys(body);
  if (keys.length !== 1 || keys[0] !== 'data') return body;
  const data = (body as { data: unknown }).data;
  if (Array.isArray(data)) return { data, total: data.length };
  return data && typeof data === 'object' ? data : body;
}

export const envelopeInterceptor: HttpInterceptorFn = (req, next) =>
  req.url.startsWith('/api')
    ? next(req).pipe(map((ev) => (ev instanceof HttpResponse ? ev.clone({ body: unwrapEnvelope(ev.body) }) : ev)))
    : next(req);
