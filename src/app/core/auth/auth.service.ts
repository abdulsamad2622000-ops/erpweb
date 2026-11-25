import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, switchMap } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { LoginRequest, LoginResponse, MeResponse, ResendResponse, ResetPasswordRequest } from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly base = APP_CONFIG.apiBase;

  private csrf(): Observable<void> {
    return this.http.get<void>('/sanctum/csrf-cookie');
  }

  login(body: LoginRequest): Observable<LoginResponse | null> {
    return this.csrf().pipe(
      switchMap(() => this.http.post<LoginResponse | null>(`${this.base}/auth/login`, body)),
    );
  }

  twoFactor(code: string): Observable<void> {
    return this.http.post<void>(`${this.base}/auth/two-factor`, { code });
  }

  resendTwoFactor(): Observable<ResendResponse> {
    return this.http.post<ResendResponse>(`${this.base}/auth/two-factor/resend`, {});
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.base}/auth/logout`, {});
  }

  me(): Observable<MeResponse> {
    return this.http.get<MeResponse>(`${this.base}/me`);
  }

  /** Backend ka jawab hamesha generic hona chahiye (email registered ho ya nahi). */
  forgotPassword(email: string): Observable<void> {
    return this.csrf().pipe(
      switchMap(() => this.http.post<void>(`${this.base}/auth/forgot-password`, { email })),
    );
  }

  resetPassword(body: ResetPasswordRequest): Observable<void> {
    return this.csrf().pipe(
      switchMap(() => this.http.post<void>(`${this.base}/auth/reset-password`, body)),
    );
  }

  /** Email par aaya 6 digit code check karta hai. Sahi ho to reset token deta hai. */
  verifyResetCode(email: string, code: string): Observable<{ token: string }> {
    return this.csrf().pipe(
      switchMap(() => this.http.post<{ token: string }>(`${this.base}/auth/forgot-password/verify`, { email, code })),
    );
  }

  /** SMS registered phone par jata hai (masked email ke saath). Jawab hamesha generic. */
  recoverEmail(phone: string): Observable<void> {
    return this.csrf().pipe(
      switchMap(() => this.http.post<void>(`${this.base}/auth/recover-email`, { phone })),
    );
  }
}