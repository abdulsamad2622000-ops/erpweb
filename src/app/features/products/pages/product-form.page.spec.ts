import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { Observable, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../../../core/auth/auth.store';
import { Branch } from '../../settings/models/org.models';
import { Brand, Category, Product } from '../models';
import { BranchLookupService } from '../services/branch-lookup.service';
import { ProductPriceHistoryService } from '../services/price-history.service';
import { BrandsService, CategoriesService, ProductsService } from '../services/products.service';
import { ProductsStore } from '../stores/products.stores';
import { ProductFormPage } from './product-form.page';

const BRANDS: Brand[] = [{ id: 1, name: 'Dell', isActive: true }];
const CATEGORIES: Category[] = [
  { id: 1, name: 'Laptops', parentId: null, isActive: true },
  { id: 2, name: 'Business Laptops', parentId: 1, isActive: true },
];
const BRANCHES: Branch[] = [
  { id: 1, code: 'KHI', name: 'Karachi Main', city: 'Karachi', address: '', phone: '', isActive: true },
  { id: 2, code: 'LHE', name: 'Lahore', city: 'Lahore', address: '', phone: '', isActive: true },
];
const PRODUCT: Product = {
  id: 1, sku: 'LAP-DELL-001', name: 'Dell Latitude 5440', barcode: null, brandId: 1, categoryId: 2, trackBatch: false,
  specs: { cpu: 'Intel Core i5', ram: '16 GB', storage: '512 GB SSD', gpu: 'Integrated', screen: '14"' },
  warrantyMonths: 24,
  costPrice: 142000,
  minPrice: 150000,
  prices: [
    { tier: 'retail', price: 165000 },
    { tier: 'wholesale', price: 155000 },
    { tier: 'dealer', price: 151000 },
  ],
  reorderLevels: [{ branchId: 1, level: 5 }],
  variants: [{ id: 1, sku: 'LAP-DELL-001-16-512', name: '16 GB / 512 GB SSD', barcode: null, isActive: true }],
  isActive: true,
};

const flush = () => new Promise<void>((resolve) => setTimeout(resolve));

async function setup(id?: string, opts: { keys?: string[]; getResult?: Observable<Product> } = {}) {
  const api = { get: vi.fn().mockReturnValue(opts.getResult ?? of(PRODUCT)) };
  const store = { save: vi.fn().mockResolvedValue(null) };
  const keys = opts.keys ?? [];
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
      { provide: AuthStore, useValue: { can: (k: string) => keys.includes(k) } },
      { provide: BranchLookupService, useValue: { list: vi.fn().mockReturnValue(of({ data: BRANCHES, total: 2 })) } },
      { provide: BrandsService, useValue: { list: vi.fn().mockReturnValue(of({ data: BRANDS, total: 1 })) } },
      {
        provide: ProductPriceHistoryService,
        useValue: {
          list: vi.fn().mockReturnValue(of([{ id: 1, productId: 1, tier: 'retail', oldPrice: 160000, newPrice: 165000, changedAt: '2026-09-01T10:00:00.000Z', changedBy: 'Super Admin' }])),
        },
      },
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

interface Inst {
  form: FormGroup;
  addVariant(): void;
}
const inst = (fixture: { componentInstance: unknown }) => fixture.componentInstance as unknown as Inst;

function openTab(fixture: { detectChanges(): void }, el: HTMLElement, id: string): void {
  el.querySelector<HTMLButtonElement>(`#tab-${id}`)?.click();
  fixture.detectChanges();
}

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
    inst(fixture).form.patchValue({ brandId: 1, categoryId: 2, tracking: 'batch', specs: { cpu: ' Intel Core i7 ', ram: '16 GB' } });
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
      warrantyMonths: 0,
      minPrice: null,
      prices: [],
      reorderLevels: [],
      variants: [],
      images: [],
      isActive: true,
    });
    expect(navigate).toHaveBeenCalledWith(['/products/list']);
  });

  it('saves prices, warranty, reorder levels and variants (with cost price when allowed)', async () => {
    const { fixture, el, store } = await setup(undefined, { keys: ['products.cost.view'] });
    fill(el, '#product-sku', 'LAP-X-001');
    fill(el, '#product-name', 'Test laptop');
    const f = inst(fixture).form;
    inst(fixture).addVariant();
    f.patchValue({
      brandId: 1,
      categoryId: 2,
      warrantyMonths: 12,
      pricing: { costPrice: 100, minPrice: 120, retail: 150 },
      variants: [{ sku: ' LAP-X-001-A ', name: ' 16 GB ' }],
    });
    f.get('reorderLevels.0.level')?.setValue(3);
    submit(el);
    await flush();
    expect(store.save).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        costPrice: 100,
        minPrice: 120,
        warrantyMonths: 12,
        prices: [{ tier: 'retail', price: 150 }],
        reorderLevels: [{ branchId: 1, level: 3 }],
        variants: [{ sku: 'LAP-X-001-A', name: '16 GB', barcode: null, isActive: true }],
      }),
    );
  });

  it('blocks a price below the minimum price and marks the pricing tab', async () => {
    const { fixture, el, store } = await setup();
    fill(el, '#product-sku', 'LAP-X-001');
    fill(el, '#product-name', 'Test laptop');
    const f = inst(fixture).form;
    f.patchValue({ brandId: 1, categoryId: 2, pricing: { minPrice: 100, retail: 50 } });
    submit(el);
    await flush();
    fixture.detectChanges();
    expect(store.save).not.toHaveBeenCalled();
    expect(f.get('pricing.retail')?.errors).toEqual({ server: 'productForm.floorViolation' });
    expect(el.textContent).toContain('productForm.hasErrors');
  });

  it('accepts the price again after the floor is lowered', async () => {
    const { fixture, el, store } = await setup();
    fill(el, '#product-sku', 'LAP-X-001');
    fill(el, '#product-name', 'Test laptop');
    const f = inst(fixture).form;
    f.patchValue({ brandId: 1, categoryId: 2, pricing: { minPrice: 100, retail: 50 } });
    submit(el);
    await flush();
    expect(store.save).not.toHaveBeenCalled();
    f.patchValue({ pricing: { minPrice: 40 } });
    submit(el);
    await flush();
    expect(store.save).toHaveBeenCalled();
  });

  it('blocks duplicate variant SKUs and a variant SKU equal to the product SKU', async () => {
    const { fixture, el, store } = await setup();
    fill(el, '#product-sku', 'LAP-X-001');
    fill(el, '#product-name', 'Test laptop');
    const f = inst(fixture).form;
    inst(fixture).addVariant();
    inst(fixture).addVariant();
    inst(fixture).addVariant();
    f.patchValue({
      brandId: 1,
      categoryId: 2,
      variants: [
        { sku: 'A-1', name: 'a' },
        { sku: 'a-1', name: 'b' },
        { sku: 'lap-x-001', name: 'c' },
      ],
    });
    submit(el);
    await flush();
    expect(store.save).not.toHaveBeenCalled();
    expect(f.get('variants.0.sku')?.errors).toEqual({ server: 'productForm.variantSkuDuplicate' });
    expect(f.get('variants.1.sku')?.errors).toEqual({ server: 'productForm.variantSkuDuplicate' });
    expect(f.get('variants.2.sku')?.errors).toEqual({ server: 'productForm.variantSkuSameAsProduct' });
  });

  it('shows the cost price field only with products.cost.view', async () => {
    const without = await setup();
    openTab(without.fixture, without.el, 'pricing');
    expect(without.el.querySelector('#product-price-retail')).not.toBeNull();
    expect(without.el.querySelector('#product-cost')).toBeNull();
    TestBed.resetTestingModule();
    const withCost = await setup(undefined, { keys: ['products.cost.view'] });
    openTab(withCost.fixture, withCost.el, 'pricing');
    expect(withCost.el.querySelector('#product-cost')).not.toBeNull();
  });

  it('lists one reorder level box per branch', async () => {
    const { fixture, el } = await setup();
    openTab(fixture, el, 'stock');
    expect(el.querySelector('#product-warranty')).not.toBeNull();
    expect(el.querySelector('#reorder-0')).not.toBeNull();
    expect(el.querySelector('#reorder-1')).not.toBeNull();
    expect(el.textContent).toContain('Karachi Main');
    expect(el.textContent).toContain('Lahore');
  });

  it('switches tabs with the arrow keys, Home and End', async () => {
    const { fixture, el } = await setup();
    el.querySelector('#tab-basics')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    fixture.detectChanges();
    expect(el.querySelector('#product-cpu')).not.toBeNull();
    expect(el.querySelector('#product-sku')).toBeNull();
    el.querySelector('#tab-specs')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'End' }));
    fixture.detectChanges();
    expect(el.querySelector('#product-images')).not.toBeNull();
    el.querySelector('#tab-stock')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }));
    fixture.detectChanges();
    expect(el.querySelector('#product-sku')).not.toBeNull();
  });

  it('edit mode loads the product into the form', async () => {
    const { fixture, api } = await setup('1');
    expect(api.get).toHaveBeenCalledWith(1);
    const v = inst(fixture).form.getRawValue();
    expect(v.sku).toBe('LAP-DELL-001');
    expect(v.specs.cpu).toBe('Intel Core i5');
    expect(v.tracking).toBe('serialized');
    expect(v.pricing.retail).toBe(165000);
    expect(v.pricing.costPrice).toBe(142000);
    expect(v.warrantyMonths).toBe(24);
    expect(v.variants).toHaveLength(1);
    expect(v.reorderLevels).toEqual([
      { branchId: 1, level: 5 },
      { branchId: 2, level: null },
    ]);
  });

  it('edit mode saves with the product id and without cost price when not allowed', async () => {
    const { el, store } = await setup('1');
    submit(el);
    await flush();
    expect(store.save).toHaveBeenCalledWith(1, expect.objectContaining({ sku: 'LAP-DELL-001', warrantyMonths: 24 }));
    expect(store.save.mock.calls[0][1]).not.toHaveProperty('costPrice');
  });

  it('puts a SKU error from the server on the sku field', async () => {
    const { fixture, el, store } = await setup('1');
    store.save.mockResolvedValue('This SKU already exists.');
    submit(el);
    await flush();
    expect(inst(fixture).form.get('sku')?.errors).toEqual({ server: 'This SKU already exists.' });
  });

  it('shows an error state when the product cannot be loaded', async () => {
    const { el } = await setup('1', { getResult: throwError(() => new Error('boom')) });
    expect(el.textContent).toContain('productForm.loadFailed');
    expect(el.querySelector('form')).toBeNull();
  });

  it('shows the price history under the pricing tab in edit mode only', async () => {
    const edit = await setup('1');
    openTab(edit.fixture, edit.el, 'pricing');
    expect(edit.el.textContent).toContain('productForm.historyTitle');
    expect(edit.el.textContent).toContain('165,000');
    expect(edit.el.textContent).toContain('Super Admin');
    TestBed.resetTestingModule();
    const add = await setup();
    openTab(add.fixture, add.el, 'pricing');
    expect(add.el.textContent).not.toContain('productForm.historyTitle');
  });

  async function addImages(fixture: { detectChanges(): void }, el: HTMLElement, files: File[]): Promise<void> {
    const input = el.querySelector<HTMLInputElement>('#product-images');
    if (!input) throw new Error('file input not found');
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    input.dispatchEvent(new Event('change'));
    await new Promise<void>((resolve) => setTimeout(resolve, 50));
    fixture.detectChanges();
  }

  it('blocks a barcode with spaces and the same barcode used twice', async () => {
    const { fixture, el, store } = await setup();
    fill(el, '#product-sku', 'LAP-X-001');
    fill(el, '#product-name', 'Test laptop');
    const f = inst(fixture).form;
    inst(fixture).addVariant();
    f.patchValue({ brandId: 1, categoryId: 2, barcode: 'AB 12' });
    submit(el);
    await flush();
    expect(store.save).not.toHaveBeenCalled();
    expect(f.get('barcode')?.errors).toEqual({ server: 'productForm.barcodeFormat' });
    f.patchValue({ barcode: 'ABC123', variants: [{ sku: 'V-1', name: 'v', barcode: 'abc123' }] });
    submit(el);
    await flush();
    expect(store.save).not.toHaveBeenCalled();
    expect(f.get('barcode')?.errors).toEqual({ server: 'productForm.barcodeDuplicate' });
    expect(f.get('variants.0.barcode')?.errors).toEqual({ server: 'productForm.barcodeDuplicate' });
  });

  it('adds images, rejects a wrong file type and keeps exactly one main image', async () => {
    const { fixture, el } = await setup();
    openTab(fixture, el, 'images');
    await addImages(fixture, el, [
      new File(['x'], 'a.png', { type: 'image/png' }),
      new File(['x'], 'notes.txt', { type: 'text/plain' }),
      new File(['y'], 'b.jpg', { type: 'image/jpeg' }),
    ]);
    expect(el.querySelectorAll('#panel-images img').length).toBe(2);
    expect(el.querySelectorAll('#panel-images [aria-pressed]').length).toBe(2);
    expect(el.querySelectorAll('#panel-images [aria-pressed="true"]').length).toBe(1);
    expect(el.querySelector('#panel-images [role="alert"]')?.textContent).toContain('productForm.imageBadType');
  });

  it('changes and removes the main image', async () => {
    const { fixture, el } = await setup();
    openTab(fixture, el, 'images');
    await addImages(fixture, el, [
      new File(['x'], 'a.png', { type: 'image/png' }),
      new File(['y'], 'b.jpg', { type: 'image/jpeg' }),
    ]);
    const pressed = () => Array.from(el.querySelectorAll<HTMLButtonElement>('#panel-images [aria-pressed]'));
    pressed()[1]?.click();
    fixture.detectChanges();
    expect(pressed()[1]?.getAttribute('aria-pressed')).toBe('true');
    el.querySelectorAll<HTMLButtonElement>('#panel-images button[aria-label^="productForm.removeImage"]')[1]?.click();
    fixture.detectChanges();
    expect(el.querySelectorAll('#panel-images img').length).toBe(1);
    expect(pressed()[0]?.getAttribute('aria-pressed')).toBe('true');
  });

  it('saves the images with the product', async () => {
    const { fixture, el, store } = await setup();
    fill(el, '#product-sku', 'LAP-X-001');
    fill(el, '#product-name', 'Test laptop');
    inst(fixture).form.patchValue({ brandId: 1, categoryId: 2 });
    openTab(fixture, el, 'images');
    await addImages(fixture, el, [new File(['x'], 'a.png', { type: 'image/png' })]);
    submit(el);
    await flush();
    expect(store.save).toHaveBeenCalledWith(
      null,
      expect.objectContaining({
        images: [{ url: expect.stringContaining('data:image/png'), name: 'a.png', isPrimary: true }],
      }),
    );
  });
});