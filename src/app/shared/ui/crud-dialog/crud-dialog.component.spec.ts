import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { CrudDialogComponent } from './crud-dialog.component';

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

describe('CrudDialog', () => {
  function setup(saving = false) {
    TestBed.configureTestingModule({
      imports: [
        CrudDialogComponent,
        TranslocoTestingModule.forRoot({
          langs: { en: {} },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
    });
    const fixture = TestBed.createComponent(CrudDialogComponent);
    fixture.componentRef.setInput('title', 'Add brand');
    fixture.componentRef.setInput('saving', saving);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      el,
      dialog: el.querySelector('dialog') as HTMLDialogElement,
      buttons: () => Array.from(el.querySelectorAll('button')),
    };
  }

  it('shows the title and opens and closes the dialog', () => {
    const { fixture, el, dialog } = setup();
    expect(el.querySelector('h2')?.textContent).toContain('Add brand');
    expect(dialog.hasAttribute('open')).toBe(false);
    fixture.componentInstance.open();
    expect(dialog.hasAttribute('open')).toBe(true);
    fixture.componentInstance.close();
    expect(dialog.hasAttribute('open')).toBe(false);
  });

  it('emits save on submit', () => {
    const { fixture, el } = setup();
    const spy = vi.fn();
    fixture.componentInstance.save.subscribe(spy);
    (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('cancel closes the dialog', () => {
    const { fixture, buttons, dialog } = setup();
    fixture.componentInstance.open();
    (buttons()[0] as HTMLButtonElement).click();
    expect(dialog.hasAttribute('open')).toBe(false);
  });

  it('emits closed when the dialog closes', () => {
    const { fixture, dialog } = setup();
    const spy = vi.fn();
    fixture.componentInstance.closed.subscribe(spy);
    dialog.dispatchEvent(new Event('close'));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('disables save while saving', () => {
    const { buttons } = setup(true);
    expect((buttons()[1] as HTMLButtonElement).disabled).toBe(true);
  });
});