import { describe, expect, it } from 'vitest';
import { Brand, Category } from '../models';
import { buildImportProduct } from './import-utils';

const brands: Brand[] = [{ id: 1, name: 'Dell', isActive: true }];
const cats: Category[] = [
  { id: 1, name: 'Laptops', parentId: null, isActive: true },
  { id: 2, name: 'Desktops', parentId: null, isActive: true },
  { id: 3, name: 'Accessories', parentId: 1, isActive: true },
  { id: 4, name: 'Accessories', parentId: 2, isActive: true },
];
const row = (o: Record<string, string | number | null> = {}) => ({
  sku: 'A-1', name: 'Test', barcode: '', brand: 'dell', category: 'laptops', tracking: '', warrantyMonths: '', retail: '', wholesale: '', dealer: '', ...o,
});

describe('buildImportProduct', () => {
  it('matches brand and category by name ignoring case and builds the product', () => {
    const r = buildImportProduct(row({ retail: '150', dealer: '120', warrantyMonths: '12', tracking: 'Batch' }), brands, cats);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.body).toMatchObject({ sku: 'A-1', brandId: 1, categoryId: 1, trackBatch: true, warrantyMonths: 12, barcode: null });
      expect(r.body.prices).toEqual([{ tier: 'retail', price: 150 }, { tier: 'dealer', price: 120 }]);
    }
  });

  it('defaults to serialized, no warranty and no prices', () => {
    const r = buildImportProduct(row(), brands, cats);
    expect(r.ok && r.body.trackBatch).toBe(false);
    expect(r.ok && r.body.prices).toEqual([]);
  });

  it('fails for unknown brand, unknown or ambiguous category', () => {
    expect(buildImportProduct(row({ brand: 'Acer' }), brands, cats)).toEqual({ ok: false, error: 'Brand "Acer" not found' });
    expect(buildImportProduct(row({ category: 'Tablets' }), brands, cats).ok).toBe(false);
    expect(buildImportProduct(row({ category: 'Accessories' }), brands, cats)).toEqual({ ok: false, error: 'Category "Accessories" is ambiguous' });
  });

  it('fails for bad tracking, warranty or negative price', () => {
    expect(buildImportProduct(row({ tracking: 'quantity' }), brands, cats).ok).toBe(false);
    expect(buildImportProduct(row({ warrantyMonths: '200' }), brands, cats).ok).toBe(false);
    expect(buildImportProduct(row({ warrantyMonths: '1.5' }), brands, cats).ok).toBe(false);
    expect(buildImportProduct(row({ retail: '-5' }), brands, cats).ok).toBe(false);
  });
});