import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../../../core/auth/auth.store';
import { ConfirmDialogService } from '../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { DEFAULT_TABLE_QUERY } from '../../../shared/ui/data-table/data-table.models';
import { Brand, Category, Product } from '../models';
import { BrandsService, CategoriesService } from '../services/products.service';
import { ProductsStore } from '../stores/products.stores';
import { ProductsPage } from './products.page';

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

const BRANDS: Brand[] = [
  { id: 1, name: 'Dell', isActive: true },
  { id: 2, name: 'HP', isActive: true },
];
const CATEGORIES: Category[] = [
  { id: 1, name: 'Laptops', isActive: true },
  { id: 2, name: 'Desktops', isActive: true },
];
const ROWS: Product[] = [
  { id: 1, sku: 'LAP-DELL-001', name: 'Dell Latitude 5440', barcode: '8901000000011', brandId: 1, categoryId: 1, trackBatch: false, isActive: true },
  { id: 2, sku: 'LAP-HP-001', name: 'HP ProBook 450', barcode: null, brandId: 2, categoryId: 1, trackBatch: true, isActive: true },
];

const flush = () => new Promise<void>((resolve) => setTimeout(resolve));

function fakeStore(rows: Product[]) {
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

async function setup(keys: string[]) {
  const store = fakeStore(ROWS);
  const brandsApi = { list: vi.fn().mockReturnValue(of({ data: BRANDS, total: BRANDS.length })) };
  const categoriesApi = { list: vi.fn().mockReturnValue(of({ data: CATEGORIES, total: CATEGORIES.length })) };
  TestBed.configureTestingModule({
    imports: [
      ProductsPage,
      TranslocoTestingModule.forRoot({
        langs: { en: {} },
        translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
      }),
    ],
    providers: [
      { provide: ProductsStore, useValue: store },
      { provide: BrandsService, useValue: brandsApi },
      { provide: CategoriesService, useValue: categoriesApi },
      { provide: AuthStore, useValue: fakeAuth(keys) },
    ],
  });
  const fixture = TestBed.createComponent(ProductsPage);
  fixture.detectChanges();
  await flush();
  fixture.detectChanges();
  fixture.detectChanges();
  return {
    fixture,
    el: fixture.nativeElement as HTMLElement,
    store,
    brandsApi,
    categoriesApi,
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

describe('ProductsPage', () => {
  it('loads the products and the brand and category lists', async () => {
    const { store, brandsApi, categoriesApi } = await setup(['products.product.view']);
    expect(store.load).toHaveBeenCalled();
    expect(brandsApi.list).toHaveBeenCalled();
    expect(categoriesApi.list).toHaveBeenCalled();
  });

  it('shows sku, brand, category and tracking type in the table', async () => {
    const { el } = await setup(['products.product.view']);
    const body = el.querySelector('tbody')?.textContent ?? '';
    expect(body).toContain('LAP-DELL-001');
    expect(body).toContain('Dell');
    expect(body).toContain('Laptops');
    expect(body).toContain('products.serialized');
    expect(body).toContain('products.batch');
  });

  it('hides add, edit and delete without permission', async () => {
    const { el } = await setup([]);
    expect(buttonByText(el, 'products.add')).toBeUndefined();
    expect(rowButtons(el).length).toBe(0);
  });

  it('shows add, edit and delete with permission', async () => {
    const { el } = await setup(['products.product.create', 'products.product.edit', 'products.product.delete']);
    expect(buttonByText(el, 'products.add')).toBeDefined();
    expect(rowButtons(el).length).toBe(ROWS.length * 2);
  });

  it('does not save when brand and category are not chosen', async () => {
    const { el, store } = await setup(['products.product.create']);
    buttonByText(el, 'products.add')?.click();
    fill(el, '#product-sku', 'LAP-X-001');
    fill(el, '#product-name', 'Test laptop');
    submit(el);
    await flush();
    expect(store.save).not.toHaveBeenCalled();
  });

  it('creates a product from the form', async () => {
    const { fixture, el, store } = await setup(['products.product.create']);
    buttonByText(el, 'products.add')?.click();
    fill(el, '#product-sku', 'LAP-X-001');
    fill(el, '#product-name', 'Test laptop');
    formOf(fixture).patchValue({ brandId: 1, categoryId: 2, tracking: 'batch' });
    submit(el);
    await flush();
    expect(store.save).toHaveBeenCalledWith(null, {
      sku: 'LAP-X-001',
      name: 'Test laptop',
      barcode: null,
      brandId: 1,
      categoryId: 2,
      trackBatch: true,
      isActive: true,
    });
  });

  it('fills the form when editing and saves with the id', async () => {
    const { fixture, el, store } = await setup(['products.product.edit']);
    rowButtons(el)[0]?.click();
    expect(formOf(fixture).getRawValue()).toMatchObject({
      sku: 'LAP-DELL-001',
      brandId: 1,
      categoryId: 1,
      tracking: 'serialized',
    });
    fill(el, '#product-name', 'Renamed');
    submit(el);
    await flush();
    expect(store.save).toHaveBeenCalledWith(1, {
      sku: 'LAP-DELL-001',
      name: 'Renamed',
      barcode: '8901000000011',
      brandId: 1,
      categoryId: 1,
      trackBatch: false,
      isActive: true,
    });
  });

  it('puts a SKU error on the sku field', async () => {
    const { fixture, el, store } = await setup(['products.product.create']);
    store.save.mockResolvedValue('This SKU already exists.');
    buttonByText(el, 'products.add')?.click();
    fill(el, '#product-sku', 'LAP-DELL-001');
    fill(el, '#product-name', 'Dup');
    formOf(fixture).patchValue({ brandId: 1, categoryId: 1 });
    submit(el);
    await flush();
    expect(formOf(fixture).get('sku')?.errors).toEqual({ server: 'This SKU already exists.' });
  });

  it('puts any other server error on the name field', async () => {
    const { fixture, el, store } = await setup(['products.product.create']);
    store.save.mockResolvedValue('Something went wrong.');
    buttonByText(el, 'products.add')?.click();
    fill(el, '#product-sku', 'NEW-1');
    fill(el, '#product-name', 'New');
    formOf(fixture).patchValue({ brandId: 1, categoryId: 1 });
    submit(el);
    await flush();
    expect(formOf(fixture).get('name')?.errors).toEqual({ server: 'Something went wrong.' });
  });

  it('deletes after confirmation', async () => {
    const { el, store, confirm } = await setup(['products.product.delete']);
    rowButtons(el)[0]?.click();
    expect(confirm.pending()).not.toBeNull();
    confirm.answer(true);
    await flush();
    expect(store.remove).toHaveBeenCalledWith(1);
  });

  it('does not delete when the confirmation is cancelled', async () => {
    const { el, store, confirm } = await setup(['products.product.delete']);
    rowButtons(el)[0]?.click();
    confirm.answer(false);
    await flush();
    expect(store.remove).not.toHaveBeenCalled();
  });
});