import { Injectable, isDevMode, signal } from '@angular/core';
import { APP_CONFIG } from '../config/app-config';

const KEY = 'erp.mock'; // dev flag, koi secret nahi

@Injectable({ providedIn: 'root' })
export class MockModeService {
  // Production build mein mock hamesha off (localStorage ignore). Warna koi bhi fake admin ban sakta hai.
  readonly enabled = signal<boolean>(this.initial());

  set(on: boolean): void {
    if (!isDevMode()) return;
    this.enabled.set(on);
    localStorage.setItem(KEY, String(on));
  }

  private initial(): boolean {
    if (!isDevMode()) return false;
    const saved = localStorage.getItem(KEY);
    return saved === null ? APP_CONFIG.mockDefault : saved === 'true';
  }
}