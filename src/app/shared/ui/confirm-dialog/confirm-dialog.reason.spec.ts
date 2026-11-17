import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeAll, describe, expect, it } from 'vitest';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { ConfirmDialogService } from './confirm-dialog.service';

// jsdom mein <dialog>.showModal/close nahi hote, is liye stub.
beforeAll(() => {
  const proto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
  proto['showModal'] = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto['close'] = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

describe('ConfirmDialog reason and approval', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [
        ConfirmDialogComponent,
        TranslocoTestingModule.forRoot({
          langs: { en: {} },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
    });
    const fixture = TestBed.createComponent(ConfirmDialogComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const svc = TestBed.inject(ConfirmDialogService);
    const type = (text: string) => {
      const box = el.querySelector('textarea') as HTMLTextAreaElement;
      box.value = text;
      box.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const buttons = () => Array.from(el.querySelectorAll('button')) as HTMLButtonElement[];
    return { fixture, el, svc, type, buttons };
  }

  it('reason: textarea dikhta hai aur confirm disabled hota hai', () => {
    const { fixture, el, svc, buttons } = setup();
    void svc.reason({ title: 'Delete?', message: 'Why?' });
    fixture.detectChanges();
    expect(el.querySelector('textarea')).not.toBeNull();
    expect(buttons()[1].disabled).toBe(true);
  });

  it('reason: kam characters par confirm disabled rehta hai', () => {
    const { fixture, svc, type, buttons } = setup();
    void svc.reason({ title: 'Delete?', message: 'Why?' });
    fixture.detectChanges();
    type('short');
    expect(buttons()[1].disabled).toBe(true);
  });

  it('reason: spaces ginti mein nahi aate (trim)', () => {
    const { fixture, svc, type, buttons } = setup();
    void svc.reason({ title: 'Delete?', message: 'Why?' });
    fixture.detectChanges();
    type('ab          ');
    expect(buttons()[1].disabled).toBe(true);
  });

  it('reason: 10 characters par confirm hota hai aur trimmed text milta hai', async () => {
    const { fixture, svc, type, buttons } = setup();
    const result = svc.reason({ title: 'Delete?', message: 'Why?' });
    fixture.detectChanges();
    type('  Customer returned it  ');
    expect(buttons()[1].disabled).toBe(false);
    buttons()[1].click();
    expect(await result).toBe('Customer returned it');
  });

  it('reason: minLength badal sakte hain', () => {
    const { fixture, svc, type, buttons } = setup();
    void svc.reason({ title: 'Delete?', message: 'Why?', minLength: 20 });
    fixture.detectChanges();
    type('twelve chars');
    expect(buttons()[1].disabled).toBe(true);
  });

  it('reason: cancel par null milta hai', async () => {
    const { fixture, svc, buttons } = setup();
    const result = svc.reason({ title: 'Delete?', message: 'Why?' });
    fixture.detectChanges();
    buttons()[0].click();
    expect(await result).toBeNull();
  });

  it('approval: checkbox ke baghair confirm disabled, tick par note ke saath milta hai', async () => {
    const { fixture, el, svc, type, buttons } = setup();
    const result = svc.approve({ title: 'Approve?', message: 'Discount' });
    fixture.detectChanges();
    expect(buttons()[1].disabled).toBe(true);
    type('  Manager ok  ');
    const box = el.querySelector('input[type="checkbox"]') as HTMLInputElement;
    box.checked = true;
    box.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    expect(buttons()[1].disabled).toBe(false);
    buttons()[1].click();
    expect(await result).toEqual({ note: 'Manager ok' });
  });
});