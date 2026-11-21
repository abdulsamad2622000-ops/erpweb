import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { Observable, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../../../core/auth/auth.store';
import { ConfirmDialogService } from '../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { Reservation } from '../models/reservation.models';
import { ReservationsService } from '../services/reservations.service';
import { ReservationsPage } from './reservations.page';

const row = (id: number, customerName: string, status: Reservation['status'], holdUntil: string | null): Reservation => ({
  id, number: `RSV-000${id}`, customerName, note: null, holdUntil, status,
  lines: [{ serial: `SN-AAAA${id}`, name: 'Dell Latitude 5440', sku: 'LAP-DELL-001' }],
  createdBy: 'Mock user', createdAt: '2026-11-20T10:00:00.000Z', releasedAt: null,
});
const ROWS = [row(2, 'Ali Traders', 'active', null), row(1, 'Old Customer', 'expired', '2026-11-01')];

const flush = () => new Promise<void>((resolve) => setTimeout(resolve));

function fakeAuth(keys: string[]) {
  const grantedKeys = signal(new Set(keys));
  return { grantedKeys, can: (key: string) => grantedKeys().has(key), isAuthenticated: signal(true) };
}

async function setup(keys: string[], list: Observable<Reservation[]> = of(ROWS)) {
  const api = {
    list: vi.fn().mockReturnValue(list),
    release: vi.fn().mockReturnValue(of(ROWS[0])),
  };
  TestBed.configureTestingModule({
    imports: [
      ReservationsPage,
      TranslocoTestingModule.forRoot({
        langs: { en: {} },
        translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
      }),
    ],
    providers: [
      provideRouter([]),
      { provide: ReservationsService, useValue: api },
      { provide: AuthStore, useValue: fakeAuth(keys) },
    ],
  });
  const fixture = TestBed.createComponent(ReservationsPage);
  fixture.detectChanges();
  await flush();
  fixture.detectChanges();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, api, confirm: TestBed.inject(ConfirmDialogService) };
}

const releaseButtons = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLButtonElement>('tbody button'));

describe('ReservationsPage', () => {
  it('lists the reservations with customer and status', async () => {
    const { el } = await setup(['inventory.reservation.view']);
    const body = el.querySelector('tbody')?.textContent ?? '';
    expect(body).toContain('RSV-0002');
    expect(body).toContain('Ali Traders');
    expect(body).toContain('Old Customer');
    expect(body).toContain('reservationsPage.status.active');
    expect(body).toContain('reservationsPage.status.expired');
  });

  it('shows the new reservation link and release button only with the create permission', async () => {
    const viewer = await setup(['inventory.reservation.view']);
    expect(viewer.el.querySelector('a[href="/inventory/reservations/new"]')).toBeNull();
    expect(releaseButtons(viewer.el).length).toBe(0);
    TestBed.resetTestingModule();

    const creator = await setup(['inventory.reservation.view', 'inventory.reservation.create']);
    expect(creator.el.querySelector('a[href="/inventory/reservations/new"]')).not.toBeNull();
    expect(releaseButtons(creator.el).length).toBe(1);
  });

  it('releases after confirmation and reloads the list', async () => {
    const { el, api, confirm } = await setup(['inventory.reservation.view', 'inventory.reservation.create']);
    releaseButtons(el)[0]?.click();
    expect(confirm.pending()).not.toBeNull();
    confirm.answer(true);
    await flush();
    expect(api.release).toHaveBeenCalledWith(2);
    expect(api.list).toHaveBeenCalledTimes(2);
  });

  it('does nothing when the confirmation is cancelled', async () => {
    const { el, api, confirm } = await setup(['inventory.reservation.view', 'inventory.reservation.create']);
    releaseButtons(el)[0]?.click();
    confirm.answer(false);
    await flush();
    expect(api.release).not.toHaveBeenCalled();
  });

  it('shows the server message when the release fails', async () => {
    const { fixture, el, api, confirm } = await setup(['inventory.reservation.view', 'inventory.reservation.create']);
    api.release.mockReturnValue(throwError(() => ({ error: { message: 'This reservation has already expired.' } })));
    releaseButtons(el)[0]?.click();
    confirm.answer(true);
    await flush();
    fixture.detectChanges();
    expect(el.querySelector('p[role="alert"]')?.textContent).toContain('already expired');
  });

  it('shows an error with a retry button when loading fails', async () => {
    const { el } = await setup(['inventory.reservation.view'], throwError(() => new Error('boom')));
    expect(el.querySelector('[role="alert"]')).not.toBeNull();
    expect(el.textContent).toContain('common.retry');
  });
});