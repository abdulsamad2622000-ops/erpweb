import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, firstValueFrom } from 'rxjs';
import { CountsService } from '../../inventory/services/counts.service';
import { TransfersService } from '../../inventory/services/transfers.service';
import { errorMessage } from '../../purchase/utils/ui';
import { QueueItem, QueuePayload } from '../models/offline.models';
import { newIdempotencyKey } from '../utils/idempotency';
import { isNetworkError } from '../utils/offline-utils';
import { OFFLINE_STORE } from './offline-store';
import { PutAwayService } from './putaway.service';

export type RunResult<T> = { queued: false; result: T } | { queued: true };

/**
 * Offline queue. run(): online ho to seedha bhejta hai, warna (ya network fail par) queue mein rakhta hai.
 * Dono raaston par wahi Idempotency-Key lagti hai, isliye dobara bhejne se kaam do baar nahi hota.
 */
@Injectable({ providedIn: 'root' })
export class OfflineQueueService {
  private readonly store = inject(OFFLINE_STORE);
  private readonly putAway = inject(PutAwayService);
  private readonly transfers = inject(TransfersService);
  private readonly counts = inject(CountsService);
  private readonly i18n = inject(TranslocoService);

  readonly online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  readonly items = signal<QueueItem[]>([]);
  readonly syncing = signal(false);
  readonly pendingCount = computed(() => this.items().filter((i) => i.status === 'pending').length);
  readonly conflictCount = computed(() => this.items().filter((i) => i.status === 'conflict').length);
  readonly ready: Promise<void>;

  constructor() {
    this.ready = this.load();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.online.set(true);
        void this.sync();
      });
      window.addEventListener('offline', () => this.online.set(false));
    }
  }

  private async load(): Promise<void> {
    try {
      const all = await this.store.getAll<QueueItem>('queue');
      this.items.set(all.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    } catch {
      this.items.set([]);
    }
  }

  async run<T>(payload: QueuePayload, label: string): Promise<RunResult<T>> {
    await this.ready;
    const id = newIdempotencyKey();
    if (this.online() && this.pendingCount() === 0) {
      try {
        return { queued: false, result: (await firstValueFrom(this.send(payload, id))) as T };
      } catch (e) {
        if (!isNetworkError(e)) throw e;
      }
    }
    await this.save({ id, payload, label, status: 'pending', attempts: 0, error: null, createdAt: new Date().toISOString() });
    if (this.online()) void this.sync();
    return { queued: true };
  }

  /** Pending items ko ek ek karke, purane pehle, bhejta hai. */
  async sync(): Promise<void> {
    if (this.syncing() || !this.online()) return;
    await this.ready;
    this.syncing.set(true);
    try {
      for (const item of this.items().filter((i) => i.status === 'pending')) {
        try {
          await firstValueFrom(this.send(item.payload, item.id));
          await this.remove(item.id);
        } catch (e) {
          if (isNetworkError(e)) break;
          await this.patch(item.id, {
            status: 'conflict',
            attempts: item.attempts + 1,
            error: errorMessage(e, this.i18n.translate('errors.generic')),
          });
        }
      }
    } finally {
      this.syncing.set(false);
    }
  }

  async retry(id: string): Promise<void> {
    await this.patch(id, { status: 'pending', error: null });
    void this.sync();
  }

  async discard(id: string): Promise<void> {
    await this.remove(id);
  }

  private send(p: QueuePayload, key: string): Observable<unknown> {
    switch (p.kind) {
      case 'putaway':
        return this.putAway.place(p.body, key);
      case 'transfer_dispatch':
        return this.transfers.action(p.transferId, 'dispatch', {}, key);
      case 'transfer_receive':
        return this.transfers.action(p.transferId, 'receive', { serials: p.serials }, key);
      case 'count_submit':
        return this.counts.action(p.countId, 'submit', { serials: p.serials }, key);
    }
  }

  private async save(item: QueueItem): Promise<void> {
    this.items.update((l) => [...l, item]);
    await this.store.put('queue', item);
  }

  private async patch(id: string, change: Partial<QueueItem>): Promise<void> {
    const current = this.items().find((i) => i.id === id);
    if (!current) return;
    const next = { ...current, ...change };
    this.items.update((l) => l.map((i) => (i.id === id ? next : i)));
    await this.store.put('queue', next);
  }

  private async remove(id: string): Promise<void> {
    this.items.update((l) => l.filter((i) => i.id !== id));
    await this.store.delete('queue', id);
  }
}