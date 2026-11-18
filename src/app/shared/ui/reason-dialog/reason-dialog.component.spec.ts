import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeAll, describe, expect, it } from 'vitest';
import { ReasonDialogComponent } from './reason-dialog.component';
import { ReasonDialogService } from './reason-dialog.service';

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

describe('ReasonDialog', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [
        ReasonDialogComponent,
        TranslocoTestingModule.forRoot({
          langs: { en: {} },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
    });
    const fixture = TestBed.createComponent(ReasonDialogComponent);
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
    return { fixture, el, type, buttons, svc: TestBed.inject(ReasonDialogService) };
  }

  it('shows the title and keeps confirm disabled until the reason is long enough', () => {
    const { fixture, el, type, buttons, svc } = setup();
    void svc.ask({ title: 'Void sale?', message: 'Why?', minLength: 5 });
    fixture.detectChanges();
    expect(el.textContent).toContain('Void sale?');
    expect(buttons()[1].disabled).toBe(true);
    type('abc');
    expect(buttons()[1].disabled).toBe(true);
    type('   ab   ');
    expect(buttons()[1].disabled).toBe(true);
    type('wrong price');
    expect(buttons()[1].disabled).toBe(false);
  });

  it('resolves the trimmed reason on confirm', async () => {
    const { fixture, type, buttons, svc } = setup();
    const result = svc.ask({ title: 'T', message: 'm' });
    fixture.detectChanges();
    type('  too late  ');
    buttons()[1].click();
    expect(await result).toBe('too late');
  });

  it('resolves null on cancel', async () => {
    const { fixture, buttons, svc } = setup();
    const result = svc.ask({ title: 'T', message: 'm' });
    fixture.detectChanges();
    buttons()[0].click();
    expect(await result).toBeNull();
  });

  it('a new ask resolves the previous one with null', async () => {
    const { svc } = setup();
    const first = svc.ask({ title: 'A', message: 'a' });
    void svc.ask({ title: 'B', message: 'b' });
    expect(await first).toBeNull();
  });
});