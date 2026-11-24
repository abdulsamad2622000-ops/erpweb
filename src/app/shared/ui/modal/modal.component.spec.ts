import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ModalComponent } from './modal.component';

@Component({
  imports: [ModalComponent],
  template: `
    <button id="opener" type="button">Open</button>
    @if (show()) {
      <app-modal labelledBy="t1" [backdropClose]="backdrop()" (closed)="closes = closes + 1">
        <h2 id="t1">Title</h2>
        <input id="inside" />
      </app-modal>
    }
  `,
})
class HostComponent {
  readonly show = signal(false);
  readonly backdrop = signal(false);
  closes = 0;
}

function setup(backdrop = false) {
  const fixture = TestBed.createComponent(HostComponent);
  fixture.componentInstance.backdrop.set(backdrop);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const q = <T extends Element>(sel: string): T => {
    const found = el.querySelector<T>(sel);
    if (!found) throw new Error(`not found: ${sel}`);
    return found;
  };
  const open = (): void => {
    fixture.componentInstance.show.set(true);
    fixture.detectChanges();
  };
  return { fixture, host: fixture.componentInstance, q, open };
}

describe('ModalComponent', () => {
  it('opens a labelled dialog with the projected content', () => {
    const { q, open } = setup();
    open();
    const dlg = q<HTMLDialogElement>('dialog');
    expect(dlg.hasAttribute('open')).toBe(true);
    expect(dlg.getAttribute('aria-labelledby')).toBe('t1');
    expect(dlg.textContent).toContain('Title');
  });

  it('Esc (cancel) asks the parent to close and keeps the dialog open itself', () => {
    const { host, q, open } = setup();
    open();
    const dlg = q<HTMLDialogElement>('dialog');
    const cancel = new Event('cancel', { cancelable: true });
    dlg.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(host.closes).toBe(1);
    expect(dlg.hasAttribute('open')).toBe(true);
  });

  it('a click on the backdrop does nothing unless backdropClose is on', () => {
    const { host, q, open } = setup(false);
    open();
    const dlg = q<HTMLDialogElement>('dialog');
    dlg.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    dlg.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(host.closes).toBe(0);
  });

  it('closes on a real backdrop click when backdropClose is on', () => {
    const { host, q, open } = setup(true);
    open();
    const dlg = q<HTMLDialogElement>('dialog');
    dlg.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    dlg.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(host.closes).toBe(1);
  });

  it('does not close when the press started inside and ended on the backdrop', () => {
    const { host, q, open } = setup(true);
    open();
    q<HTMLInputElement>('#inside').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    q<HTMLDialogElement>('dialog').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(host.closes).toBe(0);
  });

  it('a click on the content does not close it', () => {
    const { host, q, open } = setup(true);
    open();
    q<HTMLElement>('#t1').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    q<HTMLElement>('#t1').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(host.closes).toBe(0);
  });

  it('gives the focus back to the element that opened it', () => {
    const { fixture, host, q, open } = setup();
    const opener = q<HTMLButtonElement>('#opener');
    opener.focus();
    open();
    q<HTMLInputElement>('#inside').focus();
    expect(document.activeElement).not.toBe(opener);
    host.show.set(false);
    fixture.detectChanges();
    expect(document.activeElement).toBe(opener);
  });
});