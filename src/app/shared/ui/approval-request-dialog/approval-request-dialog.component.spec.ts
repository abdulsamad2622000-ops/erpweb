import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeAll, describe, expect, it } from 'vitest';
import { ApprovalRequestDialogComponent } from './approval-request-dialog.component';
import { ApprovalRequestDialogService } from './approval-request-dialog.service';

beforeAll(() => {
  const proto = HTMLDialogElement.prototype as unknown as Record<string, unknown>;
  proto['showModal'] = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  proto['close'] = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

describe('ApprovalRequestDialog', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [
        ApprovalRequestDialogComponent,
        TranslocoTestingModule.forRoot({
          langs: { en: {} },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
    });
    const fixture = TestBed.createComponent(ApprovalRequestDialogComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const type = (value: string): void => {
      const ta = el.querySelector('textarea') as HTMLTextAreaElement;
      ta.value = value;
      ta.dispatchEvent(new Event('input'));
      fixture.detectChanges();
    };
    const buttons = (): HTMLButtonElement[] =>
      Array.from(el.querySelectorAll('button')) as HTMLButtonElement[];
    return { fixture, el, type, buttons, svc: TestBed.inject(ApprovalRequestDialogService) };
  }

  it('shows the action and keeps submit disabled until a reason is typed', () => {
    const { fixture, el, type, buttons, svc } = setup();
    void svc.request({ action: 'Void sale #42' });
    fixture.detectChanges();
    expect(el.textContent).toContain('Void sale #42');
    expect(buttons()[1].disabled).toBe(true);
    type('abc');
    expect(buttons()[1].disabled).toBe(true);
    type('customer returned item');
    expect(buttons()[1].disabled).toBe(false);
  });

  it('resolves { reason } on submit', async () => {
    const { fixture, type, buttons, svc } = setup();
    const result = svc.request({ action: 'Discount 20%' });
    fixture.detectChanges();
    type('  manager asked  ');
    buttons()[1].click();
    expect(await result).toEqual({ reason: 'manager asked' });
  });

  it('resolves null on cancel', async () => {
    const { fixture, buttons, svc } = setup();
    const result = svc.request({ action: 'X' });
    fixture.detectChanges();
    buttons()[0].click();
    expect(await result).toBeNull();
  });
});