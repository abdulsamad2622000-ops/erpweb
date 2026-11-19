import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { Brand, Category, Product } from '../models';
import { BrandsService, CategoriesService, ProductsService } from '../services/products.service';
import { ProductsStore } from '../stores/products.stores';
import { ProductFormPage } from './product-form.page';

const BRANDS: Brand[] = [{ id: 1, name: 'Dell', isActive: true }];
const CATEGORIES: Category[] = [
  { id: 1, name: 'Laptops', parentId: null, isActive: true },
  { id: 2, name: 'Business Laptops', parentId: 1, isActive: true },
];
const PRODUCT: Product = {
  id: 1, sku: 'LAP-DELL-001', name: 'Dell Latitude 5440', barcode: null, brandId: 1, categoryId: 2, trackBatch: false,
  specs: { cpu: 'Intel Core i5', ram: '16 GB', storage: '512 GB SSD', gpu: 'Integrated', screen: '14"' }, isActive: true,
};

const flush = () => new Promise<void>((resolve) => setTimeout(resolve));

async function setup(id?: string, getResult = of(PRODUCT)) {
  const api = { get: vi.fn().mockReturnValue(getResult) };
  const store = { save: vi.fn().mockResolvedValue(null) };
  TestBed.configureTestingModule({
    imports: [
      ProductFormPage,
      TranslocoTestingModule.forRoot({
        langs: { en: {} },
        translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
      }),
    ],
    providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap(id ? { id } : {}) } } },
      { provide: ProductsService, useValue: api },
      { provide: ProductsStore, useValue: store },
      { provide: BrandsService, useValue: { list: vi.fn().mockReturnValue(of({ data: BRANDS, total: 1 })) } },
      { provide: CategoriesService, useValue: { list: vi.fn().mockReturnValue(of({ data: CATEGORIES, total: 2 })) } },
    ],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const fixture = TestBed.createComponent(ProductFormPage);
  fixture.detectChanges();
  await flush();
  fixture.detectChanges();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, api, store, navigate };
}

function fill(el: HTMLElement, selector: string, value: string): void {
  const input = el.querySelector<HTMLInputElement>(selector);
  if (!input) throw new Error(`input not found: ${selector}`);
  input.value = value;
  input.dispatchEvent(new Event('input'));
}
const submit = (el: HTMLElement) => (el.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
const formOf = (fixture: { componentInstance: unknown }) =>
  (fixture.componentInstance as unknown as { form: FormGroup }).form;

describe('ProductFormPage', () => {
  it('opens on the basics tab with the category tree in the dropdown', async () => {
    const { el } = await setup();
    expect(el.querySelector('#product-sku')).not.toBeNull();
    expect(el.querySelector('#product-cpu')).toBeNull();
    expect(el.querySelector('#product-category')?.textContent).toContain('\u2014 Business Laptops');
  });

  it('does not save without brand and category, and marks the basics tab', async () => {
    const { fixture, el, store } = await setup();
    fill(el, '#product-sku', 'LAP-X-001');
    fill(el, '#product-name', 'Test laptop');
    submit(el);
    await flush();
    fixture.detectChanges();
    expect(store.save).not.toHaveBeenCalled();
    expect(el.textContent).toContain('productForm.hasErrors');
  });

  it('creates a product with specs and goes back to the list', async () => {
    const { fixture, el, store, navigate } = await setup();
    fill(el, '#product-sku', 'LAP-X-001');
    fill(el, '#product-name', 'Test laptop');
    formOf(fixture).patchValue({ brandId: 1, categoryId: 2, tracking: 'batch', specs: { cpu: ' Intel Core i7 ', ram: '16 GB' } });
    submit(el);
    await flush();
    expect(store.save).toHaveBeenCalledWith(null, {
      sku: 'LAP-X-001',
      name: 'Test laptop',
      barcode: null,
      brandId: 1,
      categoryId: 2,
      trackBatch: true,
      specs: { cpu: 'Intel Core i7', ram: '16 GB', storage: '', gpu: '', screen: '' },
      isActive: true,
    });
    expect(navigate).toHaveBeenCalledWith(['/products/list']);
  });

  it('switches tabs with the arrow keys', async () => {
    const { fixture, el } = await setup();
    el.querySelector('#tab-basics')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    fixture.detectChanges();
    expect(el.querySelector('#product-cpu')).not.toBeNull();
    expect(el.querySelector('#product-sku')).toBeNull();
    el.querySelector('#tab-specs')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    fixture.detectChanges();
    expect(el.querySelector('#product-sku')).not.toBeNull();
  });

  it('edit mode loads the product into the form', async () => {
    const { fixture, api } = await setup('1');
    expect(api.get).toHaveBeenCalledWith(1);
    const v = formOf(fixture).getRawValue();
    expect(v.sku).toBe('LAP-DELL-001');
    expect(v.specs.cpu).toBe('Intel Core i5');
    expect(v.tracking).toBe('serialized');
  });

  it('edit mode saves with the product id', async () => {
    const { el, store } = await setup('1');
    submit(el);
    await flush();
    expect(store.save).toHaveBeenCalledWith(1, expect.objectContaining({ sku: 'LAP-DELL-001' }));
  });

  it('puts a SKU error from the server on the sku field', async () => {
    const { fixture, el, store } = await setup('1');
    store.save.mockResolvedValue('This SKU already exists.');
    submit(el);
    await flush();
    expect(formOf(fixture).get('sku')?.errors).toEqual({ server: 'This SKU already exists.' });
  });

  it('shows an error state when the product cannot be loaded', async () => {
    const { el } = await setup('1', throwError(() => new Error('boom')) as never);
    expect(el.textContent).toContain('productForm.loadFailed');
    expect(el.querySelector('form')).toBeNull();
  });
});