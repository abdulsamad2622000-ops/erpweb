import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ReservationsService } from '../services/reservations.service';
import { ReservationNewPage } from './reservation-new.page';

const flush = () => new Promise<void>((resolve) => setTimeout(resolve));

function setup() {
  const api = { create: vi.fn().mockReturnValue(of({ id: 1 })) };
  TestBed.configureTestingModule({
    imports: [
      ReservationNewPage,
      TranslocoTestingModule.forRoot({
        langs: { en: {} },
        translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
      }),
    ],
    providers: [provideRouter([{ path: 'inventory/reservations', children: [] }]), { provide: ReservationsService, useValue: api }],
  });
  const fixture = TestBed.createComponent(ReservationNewPage);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  return { fixture, el, api };
}

function type(el: HTMLElement, selector: string, value: string): void {
  const input = el.querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
  if (!input) throw new Error(`not found: ${selector}`);
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function addSerials(el: HTMLElement, text: string): void {
  const box = el.querySelector<HTMLInputElement>('#res-serial');
  if (!box) throw new Error('serial box not found');
  box.value = text;
  box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
}

const chips = (el: HTMLElement) => Array.from(el.querySelectorAll('ul li code')).map((c) => c.textContent?.trim());
const submit = (el: HTMLElement) => (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));

describe('ReservationNewPage', () => {
  it('adds a typed serial and a pasted list, without duplicates', () => {
    const { fixture, el } = setup();
    addSerials(el, 'ab12 cd34');
    addSerials(el, 'XY99,AB12cd34');
    fixture.detectChanges();
    expect(chips(el)).toEqual(['AB12CD34', 'XY99']);
  });

  it('removes a serial', () => {
    const { fixture, el } = setup();
    addSerials(el, 'AAAA1111,BBBB2222');
    fixture.detectChanges();
    el.querySelector<HTMLButtonElement>('ul li button')?.click();
    fixture.detectChanges();
    expect(chips(el)).toEqual(['BBBB2222']);
  });

  it('does not save without a customer name', async () => {
    const { el, api } = setup();
    addSerials(el, 'AAAA1111');
    submit(el);
    await flush();
    expect(api.create).not.toHaveBeenCalled();
  });

  it('asks for at least one serial', async () => {
    const { fixture, el, api } = setup();
    type(el, '#res-customer', 'Ali Traders');
    submit(el);
    await flush();
    fixture.detectChanges();
    expect(api.create).not.toHaveBeenCalled();
    expect(el.querySelector('p[role="alert"]')?.textContent).toContain('reservationsPage.needSerial');
  });

  it('creates the reservation and goes back to the list', async () => {
    const { fixture, el, api } = setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    type(el, '#res-customer', '  Ali Traders ');
    type(el, '#res-note', 'Deliver on Monday');
    addSerials(el, 'AAAA1111,BBBB2222');
    fixture.detectChanges();
    submit(el);
    await flush();
    expect(api.create).toHaveBeenCalledWith({
      customerName: 'Ali Traders',
      note: 'Deliver on Monday',
      holdUntil: null,
      serials: ['AAAA1111', 'BBBB2222'],
    });
    expect(navigate).toHaveBeenCalledWith('/inventory/reservations');
  });

  it('shows the server message when saving fails', async () => {
    const { fixture, el, api } = setup();
    api.create.mockReturnValue(throwError(() => ({ error: { message: 'Serial AAAA1111 is already reserved (RSV-0001).' } })));
    type(el, '#res-customer', 'Ali Traders');
    addSerials(el, 'AAAA1111');
    fixture.detectChanges();
    submit(el);
    await flush();
    fixture.detectChanges();
    expect(el.querySelector('p[role="alert"]')?.textContent).toContain('already reserved');
  });
});