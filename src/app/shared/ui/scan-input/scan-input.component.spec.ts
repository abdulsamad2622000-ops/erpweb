import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ScanEvent, ScanInputComponent } from './scan-input.component';
import { ScanSoundService } from './scan-sound.service';

let now = 0;

describe('ScanInputComponent', () => {
  beforeEach(() => {
    now = 0;
    localStorage.clear();
    vi.spyOn(performance, 'now').mockImplementation(() => now);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function setup(inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({
      imports: [
        ScanInputComponent,
        TranslocoTestingModule.forRoot({
          langs: { en: {} },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
    });
    const fixture = TestBed.createComponent(ScanInputComponent);
    fixture.componentRef.setInput('inputId', 'scan');
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const field = el.querySelector('input') as HTMLInputElement;
    const events: ScanEvent[] = [];
    const rejected: string[] = [];
    fixture.componentInstance.scanned.subscribe((e) => events.push(e));
    fixture.componentInstance.rejected.subscribe((v) => rejected.push(v));

    const press = (key: string, gap: number) => {
      now += gap;
      field.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    };
    const scan = (text: string, gap: number) => {
      for (const ch of text) press(ch, gap);
      field.value = text;
      press('Enter', gap);
      fixture.detectChanges();
    };
    return { fixture, el, field, events, rejected, scan, sound: TestBed.inject(ScanSoundService) };
  }

  it('tez burst scanner maana jata hai aur input khali ho jata hai', () => {
    const { events, field, scan } = setup();
    scan('ABC123', 10);
    expect(events).toEqual([{ value: 'ABC123', scanner: true }]);
    expect(field.value).toBe('');
  });

  it('dheere type kiya hua scanner nahi maana jata par emit hota hai', () => {
    const { events, scan } = setup();
    scan('ABC123', 200);
    expect(events).toEqual([{ value: 'ABC123', scanner: false }]);
  });

  it('scannerOnly par haath se type kiya hua reject hota hai', () => {
    const { events, rejected, scan } = setup({ scannerOnly: true });
    scan('ABC123', 200);
    expect(events).toEqual([]);
    expect(rejected).toEqual(['ABC123']);
  });

  it('scannerOnly par tez scan chal jata hai', () => {
    const { events, scan } = setup({ scannerOnly: true });
    scan('ABC123', 10);
    expect(events.length).toBe(1);
  });

  it('khali Enter par kuch emit nahi hota', () => {
    const { events, scan } = setup();
    scan('', 10);
    expect(events).toEqual([]);
  });

  it('text saaf hota hai (spaces aur control characters)', () => {
    const { events, scan } = setup();
    scan('  XY99\t ', 10);
    expect(events[0].value).toBe('XY99');
  });

  it('success par beep bajti hai, beep=false par nahi', () => {
    const a = setup();
    const spyA = vi.spyOn(a.sound, 'success');
    a.scan('ABC123', 10);
    expect(spyA).toHaveBeenCalledTimes(1);
  });

  it('beep band ho to success beep nahi bajti', () => {
    const b = setup({ beep: false });
    const spyB = vi.spyOn(b.sound, 'success');
    b.scan('ABC123', 10);
    expect(spyB).not.toHaveBeenCalled();
  });

  it('camera button default mein nahi dikhta', () => {
    const { el } = setup();
    expect(el.querySelectorAll('button').length).toBe(1);
  });

  it('showCamera par camera button dikhta hai aur event deta hai', () => {
    const { fixture, el } = setup({ showCamera: true });
    let clicked = 0;
    fixture.componentInstance.cameraClick.subscribe(() => clicked++);
    const buttons = el.querySelectorAll('button');
    expect(buttons.length).toBe(2);
    (buttons[0] as HTMLButtonElement).click();
    expect(clicked).toBe(1);
  });

  it('mute button aria-pressed badalta hai', () => {
    const { fixture, el } = setup();
    const btn = el.querySelector('button[aria-pressed]') as HTMLButtonElement;
    expect(btn.getAttribute('aria-pressed')).toBe('false');
    btn.click();
    fixture.detectChanges();
    expect(btn.getAttribute('aria-pressed')).toBe('true');
  });
});