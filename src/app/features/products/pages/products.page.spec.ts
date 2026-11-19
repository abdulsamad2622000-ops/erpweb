import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../../../core/auth/auth.store';
import { ConfirmDialogService } from '../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { DEFAULT_TABLE_QUERY } from '../../../shared/ui/data-table/data-table.models';
import { Brand, Category, Product } from '../models';
import { BrandsService, CategoriesService } from '../services/products.service';
import { ProductsStore } from '../stores/products.stores';
import { ProductsPage } from './products.page';

const BRANDS: Brand[] = [
  { id: 1, name: 'Dell', isActive: true },
  { id: 2, name: 'HP', isActive: true },
];
const CATEGORIES: Category[] = [
  { id: 1, name: 'Laptops', parentId: null, isActive: true },
  { id: 2, name: 'Business Laptops', parentId: 1, isActive: true },
];
const ROWS: Product[] = [
  { id: 1, sku: 'LAP-DELL-001', name: 'Dell Latitude 5440', barcode: '8901000000011', brandId: 1, categoryId: 2, trackBatch: false, specs: { cpu: 'Intel Core i5', ram: '16 GB', storage: '512 GB SSD', gpu: '', screen: '' }, isActive: true },
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
  return { grantedKeys, can: (key: string) => grantedKeys().has(key), isAuthenticated: signal(true) };
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
      provideRouter([]),
      { provide: ProductsStore, useValue: store },
      { provide: BrandsService, useValue: brandsApi },
      { provide: CategoriesService, useValue: categoriesApi },
      { provide: AuthStore, useValue: fakeAuth(keys) },
    ],
  });
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(ProductsPage);
  fixture.detectChanges();
  await flush();
  fixture.detectChanges();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, store, brandsApi, categoriesApi, navigate, confirm: TestBed.inject(ConfirmDialogService) };
}

const buttonByText = (el: HTMLElement, text: string) =>
  Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);
const rowButtons = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLButtonElement>('tbody button'));

describe('ProductsPage', () => {
  it('loads the products and the brand and category lists', async () => {
    const { store, brandsApi, categoriesApi } = await setup(['products.product.view']);
    expect(store.load).toHaveBeenCalled();
    expect(brandsApi.list).toHaveBeenCalled();
    expect(categoriesApi.list).toHaveBeenCalled();
  });

  it('shows sku, brand, category path, specs and tracking type in the table', async () => {
    const { el } = await setup(['products.product.view']);
    const body = el.querySelector('tbody')?.textContent ?? '';
    expect(body).toContain('LAP-DELL-001');
    expect(body).toContain('Dell');
    expect(body).toContain('Laptops \u203A Business Laptops');
    expect(body).toContain('Intel Core i5 / 16 GB / 512 GB SSD');
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

  it('add opens the new product page', async () => {
    const { el, navigate } = await setup(['products.product.create']);
    buttonByText(el, 'products.add')?.click();
    expect(navigate).toHaveBeenCalledWith(['/products/list/new']);
  });

  it('edit opens the edit page of that product', async () => {
    const { el, navigate } = await setup(['products.product.edit']);
    rowButtons(el)[0]?.click();
    expect(navigate).toHaveBeenCalledWith(['/products/list', 1, 'edit']);
  });

  it('deletes only after confirmation', async () => {
    const { el, store, confirm } = await setup(['products.product.delete']);
    rowButtons(el)[0]?.click();
    expect(confirm.pending()).not.toBeNull();
    confirm.answer(false);
    await flush();
    expect(store.remove).not.toHaveBeenCalled();
    rowButtons(el)[0]?.click();
    confirm.answer(true);
    await flush();
    expect(store.remove).toHaveBeenCalledWith(1);
  });

  it('shows the server message when delete fails', async () => {
    const { fixture, el, store, confirm } = await setup(['products.product.delete']);
    store.remove.mockResolvedValue('This record is in use and cannot be deleted.');
    rowButtons(el)[0]?.click();
    confirm.answer(true);
    await flush();
    fixture.detectChanges();
    expect(el.textContent).toContain('This record is in use and cannot be deleted.');
  });
});