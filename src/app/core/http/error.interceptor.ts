import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MessageService } from 'primeng/api';
import { TranslocoService } from '@jsverse/transloco';
import { catchError, throwError } from 'rxjs';
import { AuthStore } from '../auth/auth.store';

export function errorKey(status: number): string {
  if (status === 0) return 'errors.network';
  if (status === 401) return 'errors.unauthorized';
  if (status === 403) return 'errors.forbidden';
  if (status === 419) return 'errors.csrf';
  if (status === 422) return 'errors.validation';
  if (status >= 500) return 'errors.server';
  return 'errors.generic';
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(MessageService);
  const i18n = inject(TranslocoService);
  const router = inject(Router);
  const auth = inject(AuthStore);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const isMe = req.url.endsWith('/me');
      const isLogin = req.url.includes('/auth/');

      // /me par 401 = abhi login nahi, normal baat. Login ka error login page inline dikhayega.
      if (isMe || isLogin) return throwError(() => err);

      if (err.status === 401 || err.status === 419) {
        auth.reset();
        if (!router.url.startsWith('/login')) {
          void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
        }
      }
      if (err.status === 403) void router.navigateByUrl('/403');

      if (err.status !== 422) {
        toast.add({ severity: 'error', summary: i18n.translate(errorKey(err.status)), life: 5000 });
      }
      return throwError(() => err);
    }),
  );
};