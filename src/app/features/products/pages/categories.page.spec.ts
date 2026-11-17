import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../../../core/auth/auth.store';
import { ConfirmDialogService } from '../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { DEFAULT_TABLE_QUERY } from '../../../shared/ui/data-table/data-table.models';
import { Category } from '../models';
import { CategoriesStore } from '../stores/products.stores';
import { CategoriesPage } from './categories.page';

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

const ROWS: Category[] = [
  { id: 1, name: 'Dell', isActive: true },
  { id: 2, name: 'HP', isActive: false },
];

const flush = () => new Promise<void>((resolve) => setTimeout(resolve));

function fakeStore(rows: Category[]) {
  return {
    rows: signal(rows),
    total: signal(rows.length),
    loading: signal(false),
    query: signal({ ...DEFAULT_TABLE_QUERY }),
    load: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(null),
    remove: vi.fn().mockResolvedValue(null),
  };
}

function fakeAuth(keys: string[]) {
  const grantedKeys = signal(new Set(keys));
  return {
    grantedKeys,
    can: (key: string) => grantedKeys().has(key),
    isAuthenticated: signal(true),
  };
}

function setup(keys: string[]) {
  const store = fakeStore(ROWS);
  TestBed.configureTestingModule({
    imports: [
      CategoriesPage,
      TranslocoTestingModule.forRoot({
        langs: { en: {} },
        translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
      }),
    ],
    providers: [
      { provide: CategoriesStore, useValue: store },
      { provide: AuthStore, useValue: fakeAuth(keys) },
    ],
  });
  const fixture = TestBed.createComponent(CategoriesPage);
  fixture.detectChanges();
  fixture.detectChanges();
  return {
    fixture,
    el: fixture.nativeElement as HTMLElement,
    store,
    confirm: TestBed.inject(ConfirmDialogService),
  };
}

const buttonByText = (el: HTMLElement, text: string) =>
  Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);

const rowButtons = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLButtonElement>('tbody button'));

function fill(el: HTMLElement, selector: string, value: string): void {
  const input = el.querySelector<HTMLInputElement>(selector);
  if (!input) throw new Error(`input not found: ${selector}`);
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function submit(el: HTMLElement): void {
  (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
}

const formOf = (fixture: { componentInstance: unknown }) =>
  (fixture.componentInstance as unknown as { form: FormGroup }).form;

describe('CategoriesPage', () => {
  it('loads the list on init and shows the rows', () => {
    const { el, store } = setup(['products.category.view']);
    expect(store.load).toHaveBeenCalled();
    const body = el.querySelector('tbody')?.textContent ?? '';
    expect(body).toContain('Dell');
    expect(body).toContain('HP');
  });

  it('hides add, edit and delete without permission', () => {
    const { el } = setup([]);
    expect(buttonByText(el, 'categories.add')).toBeUndefined();
    expect(rowButtons(el).length).toBe(0);
  });

  it('shows add, edit and delete with permission', () => {
    const { el } = setup(['products.category.create', 'products.category.edit', 'products.category.delete']);
    expect(buttonByText(el, 'categories.add')).toBeDefined();
    expect(rowButtons(el).length).toBe(ROWS.length * 2);
  });

  it('creates a record from the form', async () => {
    const { el, store } = setup(['products.category.create']);
    buttonByText(el, 'categories.add')?.click();
    fill(el, '#category-name', 'Acer');
    submit(el);
    await flush();
    expect(store.save).toHaveBeenCalledWith(null, { name: 'Acer', isActive: true });
  });

  it('does not save an empty name', async () => {
    const { el, store } = setup(['products.category.create']);
    buttonByText(el, 'categories.add')?.click();
    submit(el);
    await flush();
    expect(store.save).not.toHaveBeenCalled();
  });

  it('edits the selected record', async () => {
    const { el, store } = setup(['products.category.edit']);
    rowButtons(el)[0]?.click();
    expect(el.querySelector<HTMLInputElement>('#category-name')?.value).toBe('Dell');
    fill(el, '#category-name', 'Dell Inc');
    submit(el);
    await flush();
    expect(store.save).toHaveBeenCalledWith(1, { name: 'Dell Inc', isActive: true });
  });

  it('puts the server error on the name field', async () => {
    const { fixture, el, store } = setup(['products.category.create']);
    store.save.mockResolvedValue('This name already exists.');
    buttonByText(el, 'categories.add')?.click();
    fill(el, '#category-name', 'Dell');
    submit(el);
    await flush();
    expect(formOf(fixture).get('name')?.errors).toEqual({ server: 'This name already exists.' });
  });

  it('deletes after confirmation', async () => {
    const { el, store, confirm } = setup(['products.category.delete']);
    rowButtons(el)[0]?.click();
    expect(confirm.pending()).not.toBeNull();
    confirm.answer(true);
    await flush();
    expect(store.remove).toHaveBeenCalledWith(1);
  });

  it('does not delete when the confirmation is cancelled', async () => {
    const { el, store, confirm } = setup(['products.category.delete']);
    rowButtons(el)[0]?.click();
    confirm.answer(false);
    await flush();
    expect(store.remove).not.toHaveBeenCalled();
  });

  it('shows the in-use message when delete fails', async () => {
    const { fixture, el, store, confirm } = setup(['products.category.delete']);
    store.remove.mockResolvedValue('This record is in use and cannot be deleted.');
    rowButtons(el)[0]?.click();
    confirm.answer(true);
    await flush();
    fixture.detectChanges();
    expect(el.querySelector('p[role="alert"]')?.textContent).toContain('in use');
  });
});