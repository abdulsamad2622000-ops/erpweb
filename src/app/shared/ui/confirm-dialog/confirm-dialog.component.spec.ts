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

describe('ConfirmDialog', () => {
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
    return { fixture, svc: TestBed.inject(ConfirmDialogService) };
  }

  it('resolves true when confirm is clicked', async () => {
    const { fixture, svc } = setup();
    const result = svc.confirm({ title: 'Delete?', message: 'Sure?', danger: true });
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Delete?');
    const buttons = el.querySelectorAll('button');
    (buttons[1] as HTMLButtonElement).click();
    expect(await result).toBe(true);
  });

  it('resolves false when cancel is clicked', async () => {
    const { fixture, svc } = setup();
    const result = svc.confirm({ title: 'Delete?', message: 'Sure?' });
    fixture.detectChanges();
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll('button');
    (buttons[0] as HTMLButtonElement).click();
    expect(await result).toBe(false);
  });

  it('a new confirm resolves the previous one with false', async () => {
    const { svc } = setup();
    const first = svc.confirm({ title: 'A', message: 'a' });
    void svc.confirm({ title: 'B', message: 'b' });
    expect(await first).toBe(false);
  });
});
