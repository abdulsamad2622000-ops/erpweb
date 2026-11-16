import { Injectable, signal } from '@angular/core';
import { APP_CONFIG } from '../config/app-config';

const KEY = 'erp.mock'; // dev flag, koi secret nahi

@Injectable({ providedIn: 'root' })
export class MockModeService {
  readonly enabled = signal<boolean>(this.initial());

  set(on: boolean): void {
    this.enabled.set(on);
    localStorage.setItem(KEY, String(on));
  }

  private initial(): boolean {
    const saved = localStorage.getItem(KEY);
    return saved === null ? APP_CONFIG.mockDefault : saved === 'true';
  }
}