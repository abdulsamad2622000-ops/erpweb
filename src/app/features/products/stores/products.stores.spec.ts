import { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrandsService, CategoriesService, ProductsService } from '../services/products.service';
import { BrandsStore, CategoriesStore, ProductsStore } from './products.stores';

interface StoreLike {
  rows(): unknown[];
  total(): number;
  loading(): boolean;
  load(): Promise<void>;
  save(id: number | null, body: unknown): Promise<string | null>;
  remove(id: number): Promise<string | null>;
}

function suite(label: string, StoreClass: Type<StoreLike>, ServiceClass: Type<unknown>, body: unknown): void {
  describe(label, () => {
    const api = { list: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() };
    let store: StoreLike;

    beforeEach(() => {
      vi.resetAllMocks();
      api.list.mockReturnValue(of({ data: [{ id: 1 }], total: 1 }));
      TestBed.configureTestingModule({ providers: [{ provide: ServiceClass, useValue: api }] });
      store = TestBed.inject(StoreClass);
    });

    it('load rows aur total set karta hai', async () => {
      await store.load();
      expect(store.rows().length).toBe(1);
      expect(store.total()).toBe(1);
      expect(store.loading()).toBe(false);
    });

    it('save (naya) kamyab ho to null deta hai', async () => {
      api.create.mockReturnValue(of({ id: 2 }));
      expect(await store.save(null, body)).toBeNull();
      expect(api.create).toHaveBeenCalledWith(body);
    });

    it('save (edit) update call karta hai', async () => {
      api.update.mockReturnValue(of({ id: 5 }));
      expect(await store.save(5, body)).toBeNull();
      expect(api.update).toHaveBeenCalledWith(5, body);
    });

    it('save fail ho to server ka message deta hai', async () => {
      api.create.mockReturnValue(throwError(() => ({ error: { message: 'This name already exists.' } })));
      expect(await store.save(null, body)).toBe('This name already exists.');
    });

    it('remove 409 par message deta hai', async () => {
      api.remove.mockReturnValue(throwError(() => ({ error: { message: 'This record is in use and cannot be deleted.' } })));
      expect(await store.remove(1)).toBe('This record is in use and cannot be deleted.');
    });

    it('remove kamyab ho to null deta hai', async () => {
      api.remove.mockReturnValue(of(undefined));
      expect(await store.remove(1)).toBeNull();
    });

    it('message na ho to generic message deta hai', async () => {
      api.remove.mockReturnValue(throwError(() => new Error('boom')));
      expect(await store.remove(1)).toBe('Something went wrong.');
    });
  });
}

suite('BrandsStore', BrandsStore, BrandsService, { name: 'Dell', isActive: true });
suite('CategoriesStore', CategoriesStore, CategoriesService, { name: 'Laptops', isActive: true });
suite('ProductsStore', ProductsStore, ProductsService, {
  sku: 'LAP-X-001',
  name: 'Test',
  barcode: null,
  brandId: 1,
  categoryId: 1,
  trackBatch: false,
  isActive: true,
});