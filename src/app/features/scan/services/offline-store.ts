import { InjectionToken } from '@angular/core';

export type StoreName = 'queue' | 'cache';

/** Chhota key-value store. Asal mein IndexedDB, tests aur purane browsers mein memory. */
export interface OfflineStore {
  getAll<T>(store: StoreName): Promise<T[]>;
  get<T>(store: StoreName, key: string): Promise<T | undefined>;
  put(store: StoreName, value: object): Promise<void>;
  delete(store: StoreName, key: string): Promise<void>;
}

const keyPath = (s: StoreName): string => (s === 'queue' ? 'id' : 'key');

export class MemoryStore implements OfflineStore {
  private readonly data: Record<StoreName, Map<string, unknown>> = { queue: new Map(), cache: new Map() };

  getAll<T>(store: StoreName): Promise<T[]> {
    return Promise.resolve([...this.data[store].values()] as T[]);
  }
  get<T>(store: StoreName, key: string): Promise<T | undefined> {
    return Promise.resolve(this.data[store].get(key) as T | undefined);
  }
  put(store: StoreName, value: object): Promise<void> {
    const key = (value as Record<string, string>)[keyPath(store)];
    this.data[store].set(key, structuredClone(value));
    return Promise.resolve();
  }
  delete(store: StoreName, key: string): Promise<void> {
    this.data[store].delete(key);
    return Promise.resolve();
  }
}

/** IndexedDB. Khul na sake (private mode wagera) to chupchap memory par chala jata hai. */
export class IdbStore implements OfflineStore {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private readonly fallback = new MemoryStore();
  private broken = false;

  private open(): Promise<IDBDatabase> {
    this.dbPromise ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('erp-scan', 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore('queue', { keyPath: 'id' });
        req.result.createObjectStore('cache', { keyPath: 'key' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return this.dbPromise;
  }

  private async run<T>(store: StoreName, mode: IDBTransactionMode, op: (s: IDBObjectStore) => IDBRequest): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(store, mode);
      let result: unknown;
      const req = op(tx.objectStore(store));
      req.onsuccess = () => {
        result = req.result;
      };
      tx.oncomplete = () => resolve(result as T);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  private async guard<T>(real: () => Promise<T>, fb: () => Promise<T>): Promise<T> {
    if (this.broken) return fb();
    try {
      return await real();
    } catch {
      this.broken = true;
      return fb();
    }
  }

  getAll<T>(store: StoreName): Promise<T[]> {
    return this.guard(
      () => this.run<T[]>(store, 'readonly', (o) => o.getAll()),
      () => this.fallback.getAll<T>(store),
    );
  }
  get<T>(store: StoreName, key: string): Promise<T | undefined> {
    return this.guard(
      () => this.run<T | undefined>(store, 'readonly', (o) => o.get(key)),
      () => this.fallback.get<T>(store, key),
    );
  }
  put(store: StoreName, value: object): Promise<void> {
    return this.guard(
      () => this.run<void>(store, 'readwrite', (o) => o.put(value)),
      () => this.fallback.put(store, value),
    );
  }
  delete(store: StoreName, key: string): Promise<void> {
    return this.guard(
      () => this.run<void>(store, 'readwrite', (o) => o.delete(key)),
      () => this.fallback.delete(store, key),
    );
  }
}

export const OFFLINE_STORE = new InjectionToken<OfflineStore>('OFFLINE_STORE', {
  providedIn: 'root',
  factory: () => (typeof indexedDB === 'undefined' ? new MemoryStore() : new IdbStore()),
});