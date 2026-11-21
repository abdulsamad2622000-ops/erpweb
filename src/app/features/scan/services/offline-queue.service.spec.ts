import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { CountsService } from '../../inventory/services/counts.service';
import { TransfersService } from '../../inventory/services/transfers.service';
import { QueuePayload } from '../models/offline.models';
import { MemoryStore, OFFLINE_STORE } from './offline-store';
import { OfflineQueueService } from './offline-queue.service';
import { PutAwayService } from './putaway.service';

const payload: QueuePayload = { kind: 'count_submit', countId: 1, serials: ['SN0001'] };
const net = () => throwError(() => new HttpErrorResponse({ status: 0 }));
const rejected = () =>
  throwError(() => new HttpErrorResponse({ status: 422, error: { message: 'Serial is not known.' } }));

function setup() {
  const place = vi.fn();
  const tAction = vi.fn();
  const cAction = vi.fn();
  TestBed.configureTestingModule({
    imports: [
      TranslocoTestingModule.forRoot({
        langs: { en: {} },
        translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
      }),
    ],
    providers: [
      { provide: OFFLINE_STORE, useValue: new MemoryStore() },
      { provide: PutAwayService, useValue: { place } },
      { provide: TransfersService, useValue: { action: tAction } },
      { provide: CountsService, useValue: { action: cAction } },
    ],
  });
  return { q: TestBed.inject(OfflineQueueService), place, tAction, cAction };
}

describe('OfflineQueueService', () => {
  it('online ho to seedha bhejta hai aur queue khali rehti hai', async () => {
    const { q, cAction } = setup();
    q.online.set(true);
    cAction.mockReturnValue(of({ id: 1 }));
    const r = await q.run(payload, 'C-1');
    expect(r).toEqual({ queued: false, result: { id: 1 } });
    expect(q.items()).toHaveLength(0);
  });

  it('offline ho to queue mein rakhta hai aur server ko nahi bhejta', async () => {
    const { q, cAction } = setup();
    q.online.set(false);
    const r = await q.run(payload, 'C-1');
    expect(r).toEqual({ queued: true });
    expect(q.items()).toHaveLength(1);
    expect(q.pendingCount()).toBe(1);
    expect(cAction).not.toHaveBeenCalled();
  });

  it('network fail ho to usi Idempotency-Key ke saath queue mein jata hai', async () => {
    const { q, cAction } = setup();
    q.online.set(true);
    cAction.mockReturnValue(net());
    const r = await q.run(payload, 'C-1');
    expect(r.queued).toBe(true);
    expect(cAction.mock.calls[0][3]).toBe(q.items()[0].id);
  });

  it('server ka 422 queue mein nahi jata, error wapas aata hai', async () => {
    const { q, cAction } = setup();
    q.online.set(true);
    cAction.mockReturnValue(rejected());
    await expect(q.run(payload, 'C-1')).rejects.toBeInstanceOf(HttpErrorResponse);
    expect(q.items()).toHaveLength(0);
  });

  it('sync kamyab ho to item hat jata hai (wahi key ke saath)', async () => {
    const { q, cAction } = setup();
    q.online.set(false);
    await q.run(payload, 'C-1');
    const id = q.items()[0].id;
    q.online.set(true);
    cAction.mockReturnValue(of({}));
    await q.sync();
    expect(q.items()).toHaveLength(0);
    expect(cAction.mock.calls[0][3]).toBe(id);
  });

  it('sync mein network fail ho to item pending rehta hai', async () => {
    const { q, cAction } = setup();
    q.online.set(false);
    await q.run(payload, 'C-1');
    q.online.set(true);
    cAction.mockReturnValue(net());
    await q.sync();
    expect(q.pendingCount()).toBe(1);
    expect(q.conflictCount()).toBe(0);
  });

  it('server mana kare to conflict banta hai, retry se wapas pending, discard se hat jata hai', async () => {
    const { q, cAction } = setup();
    q.online.set(false);
    await q.run(payload, 'C-1');
    q.online.set(true);
    cAction.mockReturnValue(rejected());
    await q.sync();
    expect(q.conflictCount()).toBe(1);
    expect(q.items()[0].error).toBe('Serial is not known.');

    cAction.mockReturnValue(net());
    await q.retry(q.items()[0].id);
    expect(q.pendingCount()).toBe(1);

    await q.discard(q.items()[0].id);
    expect(q.items()).toHaveLength(0);
  });
});