import { HttpErrorResponse } from '@angular/common/http';

/** Network band ya server tak pahunch nahi: offline queue ke liye "dobara try karo" wali halat. */
export function isNetworkError(e: unknown): boolean {
  if (!(e instanceof HttpErrorResponse)) return false;
  return e.status === 0 || e.status === 502 || e.status === 503 || e.status === 504;
}