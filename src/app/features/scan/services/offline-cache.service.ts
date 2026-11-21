import { Injectable, inject } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { isNetworkError } from '../utils/offline-utils';
import { OFFLINE_STORE } from './offline-store';

interface CacheEntry<T> {
  key: string;
  value: T;
  savedAt: string;
}

/**
 * Phone mein padhne wala data (transfers, counts, warehouses) aur scan ke draft.
 * fetch(): network chale to naya data (aur save), network band ho to save kiya hua (stale = true).
 */
@Injectable({ providedIn: 'root' })
export class OfflineCacheService {
  private readonly store = inject(OFFLINE_STORE);

  async read<T>(key: string): Promise<T | undefined> {
    try {
      return (await this.store.get<CacheEntry<T>>('cache', key))?.value;
    } catch {
      return undefined;
    }
  }

  async write(key: string, value: unknown): Promise<void> {
    try {
      await this.store.put('cache', { key, value, savedAt: new Date().toISOString() });
    } catch {
      // Cache sirf madad hai; save na ho to kaam nahi rukta.
    }
  }

  async remove(key: string): Promise<void> {
    try {
      await this.store.delete('cache', key);
    } catch {
      // Pehle se na ho to koi masla nahi.
    }
  }

  async fetch<T>(key: string, source: Observable<T>): Promise<{ value: T; stale: boolean }> {
    try {
      const value = await firstValueFrom(source);
      void this.write(key, value);
      return { value, stale: false };
    } catch (e) {
      if (!isNetworkError(e)) throw e;
      const cached = await this.read<T>(key);
      if (cached === undefined) throw e;
      return { value: cached, stale: true };
    }
  }
}