import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, switchMap } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { LoginRequest, MeResponse } from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly base = APP_CONFIG.apiBase;

  login(body: LoginRequest): Observable<void> {
    return this.http
      .get<void>('/sanctum/csrf-cookie')
      .pipe(switchMap(() => this.http.post<void>(`${this.base}/auth/login`, body)));
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.base}/auth/logout`, {});
  }

  me(): Observable<MeResponse> {
    return this.http.get<MeResponse>(`${this.base}/me`);
  }
}