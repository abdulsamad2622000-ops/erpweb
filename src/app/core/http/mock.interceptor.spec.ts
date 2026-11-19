import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { APP_CONFIG } from '../config/app-config';
import { MockModeService } from '../mock/mock-mode.service';
import { mockInterceptor } from './mock.interceptor';

function setup() {
  TestBed.configureTestingModule({
    providers: [provideHttpClient(withInterceptors([mockInterceptor])), provideHttpClientTesting()],
  });
  TestBed.inject(MockModeService).set(true);
  return { http: TestBed.inject(HttpClient), ctrl: TestBed.inject(HttpTestingController) };
}

describe('mockInterceptor', () => {
  it('serves a fixture (loaded lazily)', async () => {
    const { http } = setup();
    const res = await firstValueFrom(http.get(`${APP_CONFIG.apiBase}/health`));
    expect(res).toEqual({ status: 'ok', mock: true });
  });

  it('matches :id routes', async () => {
    const { http } = setup();
    const res = await firstValueFrom(http.get<{ id: number }>(`${APP_CONFIG.apiBase}/brands/1`));
    expect(res.id).toBe(1);
  });

  it('passes unknown paths to the real backend', async () => {
    const { http, ctrl } = setup();
    const url = `${APP_CONFIG.apiBase}/no-such-route`;
    const pending = firstValueFrom(http.get(url));
    const req = await vi.waitFor(() => ctrl.expectOne(url));
    req.flush({ ok: true });
    expect(await pending).toEqual({ ok: true });
  });
});