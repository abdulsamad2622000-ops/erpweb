import { Brand, Category, ProductInput, ProductPrice } from '../models';
import { ImportField, ImportValue } from '../../../shared/ui/import-wizard/import-utils';

export const PRODUCT_IMPORT_FIELDS: ImportField[] = [
  { key: 'sku', label: 'SKU', required: true, unique: true },
  { key: 'name', label: 'Name', required: true, aliases: ['Product name'] },
  { key: 'barcode', label: 'Barcode', unique: true },
  { key: 'brand', label: 'Brand', required: true },
  { key: 'category', label: 'Category', required: true },
  { key: 'tracking', label: 'Tracking', aliases: ['Tracking type'] },
  { key: 'warrantyMonths', label: 'Warranty months', type: 'number', aliases: ['Warranty'] },
  { key: 'retail', label: 'Retail price', type: 'number' },
  { key: 'wholesale', label: 'Wholesale price', type: 'number' },
  { key: 'dealer', label: 'Dealer price', type: 'number' },
];

export type ImportRowResult = { ok: true; body: ProductInput } | { ok: false; error: string };

const text = (v: ImportValue | undefined): string => (v === null || v === undefined ? '' : String(v).trim());
const num = (v: ImportValue | undefined): number | null => {
  const s = text(v);
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/** Ek import row ko ProductInput mein badalta hai. Brand aur category naam se (chhote/bare harf ek jaise). */
export function buildImportProduct(
  row: Record<string, ImportValue>,
  brands: readonly Brand[],
  categories: readonly Category[],
): ImportRowResult {
  const brandName = text(row['brand']).toLowerCase();
  const brand = brands.find((b) => b.name.trim().toLowerCase() === brandName);
  if (!brand) return { ok: false, error: `Brand "${text(row['brand'])}" not found` };

  const catName = text(row['category']).toLowerCase();
  const cats = categories.filter((c) => c.name.trim().toLowerCase() === catName);
  if (cats.length === 0) return { ok: false, error: `Category "${text(row['category'])}" not found` };
  if (cats.length > 1) return { ok: false, error: `Category "${text(row['category'])}" is ambiguous` };

  const trackingRaw = text(row['tracking']).toLowerCase();
  if (trackingRaw && !['serialized', 'batch', 'batch / lot', 'lot'].includes(trackingRaw)) {
    return { ok: false, error: 'Tracking must be Serialized or Batch' };
  }

  const warranty = num(row['warrantyMonths']) ?? 0;
  if (!Number.isInteger(warranty) || warranty < 0 || warranty > 120) {
    return { ok: false, error: 'Warranty months must be a whole number from 0 to 120' };
  }

  const prices: ProductPrice[] = [];
  for (const tier of ['retail', 'wholesale', 'dealer'] as const) {
    const p = num(row[tier]);
    if (p === null) continue;
    if (p < 0) return { ok: false, error: `${tier} price cannot be negative` };
    prices.push({ tier, price: p });
  }

  return {
    ok: true,
    body: {
      sku: text(row['sku']),
      name: text(row['name']),
      barcode: text(row['barcode']) || null,
      brandId: brand.id,
      categoryId: cats[0].id,
      trackBatch: trackingRaw !== '' && trackingRaw !== 'serialized',
      specs: { cpu: '', ram: '', storage: '', gpu: '', screen: '' },
      warrantyMonths: warranty,
      minPrice: null,
      prices,
      reorderLevels: [],
      variants: [],
      images: [],
      isActive: true,
    },
  };
}