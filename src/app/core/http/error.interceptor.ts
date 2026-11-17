import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { TranslocoService } from '@jsverse/transloco';
import { catchError, throwError } from 'rxjs';

export function errorKey(status: number): string {
  if (status === 0) return 'errors.network';
  if (status === 401) return 'errors.unauthorized';
  if (status === 403) return 'errors.forbidden';
  if (status === 422) return 'errors.validation';
  if (status >= 500) return 'errors.server';
  return 'errors.generic';
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(MessageService);
  const i18n = inject(TranslocoService);
  const router = inject(Router);
  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 403) void router.navigateByUrl('/403');
      if (err.status !== 422) {
        toast.add({ severity: 'error', summary: i18n.translate(errorKey(err.status)), life: 5000 });
      }
      return throwError(() => err);
    }),
  );
};