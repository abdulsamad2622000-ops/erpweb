import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { beforeAll, describe, expect, it } from 'vitest';
import { SearchSelectComponent, SelectOption, SelectOptionId } from './search-select.component';

const ALL: SelectOption[] = [
  { id: 1, label: 'Dell' },
  { id: 2, label: 'HP' },
  { id: 3, label: 'Lenovo' },
];

@Component({
  imports: [SearchSelectComponent, ReactiveFormsModule],
  template: `<app-search-select inputId="brand" [loader]="loader" [resolve]="resolve" [debounceMs]="0" [formControl]="ctrl" />`,
})
class HostComponent {
  ctrl = new FormControl<number | null>(null);
  loader = (q: string) => of(ALL.filter((o) => o.label.toLowerCase().includes(q.toLowerCase())));
  resolve = (id: SelectOptionId) => of(ALL.find((o) => o.id === id) ?? null);
}

// jsdom mein scrollIntoView nahi hota, is liye stub.
beforeAll(() => {
  (Element.prototype as unknown as Record<string, unknown>)['scrollIntoView'] = () => undefined;
});

describe('SearchSelectComponent', () => {
  function setup() {
    TestBed.configureTestingModule({
      imports: [
        HostComponent,
        TranslocoTestingModule.forRoot({
          langs: { en: {} },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        }),
      ],
    });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const input = el.querySelector('input') as HTMLInputElement;
    const flush = async () => {
      fixture.detectChanges();
      await new Promise((r) => setTimeout(r, 5));
      fixture.detectChanges();
      fixture.detectChanges();
    };
    const focus = () => input.dispatchEvent(new Event('focus'));
    const blur = () => input.dispatchEvent(new Event('blur'));
    const type = (t: string) => {
      input.value = t;
      input.dispatchEvent(new Event('input'));
    };
    const key = (k: string) =>
      input.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    const options = () =>
      Array.from(el.querySelectorAll('[role="option"]')).map((o) => o.textContent?.trim());
    return { fixture, el, input, flush, focus, blur, type, key, options, ctrl: fixture.componentInstance.ctrl };
  }

  it('focus par saari options dikhti hain', async () => {
    const { focus, flush, options } = setup();
    focus();
    await flush();
    expect(options()).toEqual(['Dell', 'HP', 'Lenovo']);
  });

  it('type karne par list filter hoti hai', async () => {
    const { type, flush, options } = setup();
    type('len');
    await flush();
    expect(options()).toEqual(['Lenovo']);
  });

  it('option click se value set hoti hai aur list band', async () => {
    const { fixture, el, input, focus, flush, ctrl } = setup();
    focus();
    await flush();
    el.querySelectorAll('[role="option"]')[2].dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
    );
    fixture.detectChanges();
    expect(ctrl.value).toBe(3);
    expect(input.value).toBe('Lenovo');
    expect(el.querySelector('[role="listbox"]')).toBeNull();
  });

  it('keyboard: ArrowDown aur Enter se doosri option chunti hai', async () => {
    const { fixture, focus, flush, key, ctrl } = setup();
    focus();
    await flush();
    key('ArrowDown');
    key('Enter');
    fixture.detectChanges();
    expect(ctrl.value).toBe(2);
  });

  it('Enter pehli option chunta hai (active = 0)', async () => {
    const { focus, flush, key, ctrl } = setup();
    focus();
    await flush();
    key('Enter');
    expect(ctrl.value).toBe(1);
  });

  it('selection ke baad type karne par value null ho jati hai', async () => {
    const { focus, flush, key, type, ctrl } = setup();
    focus();
    await flush();
    key('Enter');
    expect(ctrl.value).toBe(1);
    type('x');
    expect(ctrl.value).toBeNull();
  });

  it('control se id likhne par label resolve hota hai', async () => {
    const { input, flush, ctrl } = setup();
    ctrl.setValue(2);
    await flush();
    expect(input.value).toBe('HP');
  });

  it('Escape list band karta hai', async () => {
    const { fixture, el, focus, flush, key } = setup();
    focus();
    await flush();
    key('Escape');
    fixture.detectChanges();
    expect(el.querySelector('[role="listbox"]')).toBeNull();
  });

  it('blur par adhura text saaf ho jata hai', async () => {
    const { fixture, input, flush, blur, type } = setup();
    type('zzz');
    await flush();
    blur();
    fixture.detectChanges();
    expect(input.value).toBe('');
  });

  it('koi match na ho to empty message dikhta hai', async () => {
    const { el, flush, type } = setup();
    type('zzz');
    await flush();
    expect(el.textContent).toContain('common.empty');
  });

  it('clear button value hata deta hai', async () => {
    const { fixture, el, input, flush, ctrl } = setup();
    ctrl.setValue(2);
    await flush();
    (el.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(ctrl.value).toBeNull();
    expect(input.value).toBe('');
  });
});