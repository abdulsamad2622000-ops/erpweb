import { Brand, Category, Product } from '../../../features/products/models';
import { FixtureHandler, fail, ok } from './fixture.types';

const brands: Brand[] = [
  { id: 1, name: 'Dell', isActive: true },
  { id: 2, name: 'HP', isActive: true },
  { id: 3, name: 'Lenovo', isActive: true },
];

const categories: Category[] = [
  { id: 1, name: 'Laptops', parentId: null, isActive: true },
  { id: 2, name: 'Desktops', parentId: null, isActive: true },
  { id: 3, name: 'Business Laptops', parentId: 1, isActive: true },
  { id: 4, name: 'Gaming Laptops', parentId: 1, isActive: true },
  { id: 5, name: 'All-in-One PCs', parentId: 2, isActive: true },
];

function categoryError(b: Omit<Category, 'id'>, ignoreId: number): string | null {
  const name = (b.name ?? '').trim().toLowerCase();
  if (!name) return 'Name is required.';
  const parentId = b.parentId ?? null;
  if (parentId !== null) {
    const byId = new Map(categories.map((c) => [c.id, c] as [number, Category]));
    if (!byId.has(parentId)) return 'Parent category not found.';
    // Parent khud ya uska koi bacha nahi ho sakta.
    let cur: number | null = parentId;
    let guard = 0;
    while (cur !== null && guard++ < 50) {
      if (ignoreId !== 0 && cur === ignoreId) return 'A category cannot be placed inside itself.';
      cur = byId.get(cur)?.parentId ?? null;
    }
  }
  const clash = categories.some(
    (c) => c.id !== ignoreId && (c.parentId ?? null) === parentId && c.name.toLowerCase() === name,
  );
  return clash ? 'This name already exists here.' : null;
}

const products: Product[] = [
  { id: 1, sku: 'LAP-DELL-001', name: 'Dell Latitude 5440', barcode: '8901000000011', brandId: 1, categoryId: 1, trackBatch: false, specs: { cpu: 'Intel Core i5', ram: '16 GB', storage: '512 GB SSD', gpu: 'Integrated', screen: '14"' }, warrantyMonths: 12, costPrice: 142000, minPrice: 150000, prices: [{ tier: 'retail', price: 165000 }, { tier: 'wholesale', price: 155000 }, { tier: 'dealer', price: 151000 }], reorderLevels: [{ branchId: 1, level: 5 }], variants: [{ id: 1, sku: 'LAP-DELL-001-16-512', name: '16 GB / 512 GB SSD', barcode: null, isActive: true }], isActive: true },
  { id: 2, sku: 'LAP-HP-001', name: 'HP ProBook 450', barcode: null, brandId: 2, categoryId: 1, trackBatch: false, specs: { cpu: 'Intel Core i7', ram: '16 GB', storage: '512 GB SSD', gpu: 'Integrated', screen: '15.6"' }, warrantyMonths: 12, costPrice: 118000, minPrice: 125000, prices: [{ tier: 'retail', price: 138000 }, { tier: 'wholesale', price: 129000 }, { tier: 'dealer', price: 126000 }], reorderLevels: [{ branchId: 1, level: 3 }], variants: [], isActive: true },
  { id: 3, sku: 'DSK-LEN-001', name: 'Lenovo ThinkCentre M70s', barcode: '8901000000033', brandId: 3, categoryId: 2, trackBatch: false, specs: { cpu: 'Intel Core i5', ram: '8 GB', storage: '256 GB SSD', gpu: 'Integrated', screen: '' }, warrantyMonths: 36, costPrice: 82000, minPrice: 88000, prices: [{ tier: 'retail', price: 96000 }, { tier: 'wholesale', price: 90000 }, { tier: 'dealer', price: 88500 }], reorderLevels: [], variants: [], isActive: true },
];

const idOf = (url: string): number => Number(url.split('?')[0].split('/').pop());
const nextId = (rows: { id: number }[]): number => Math.max(0, ...rows.map((r) => r.id)) + 1;

export function paged<T>(rows: T[], url: string, searchOf: (r: T) => string) {
  const q = new URL(url, 'http://mock').searchParams;
  const page = Number(q.get('page') ?? 1);
  const pageSize = Number(q.get('pageSize') ?? 10);
  const search = (q.get('search') ?? '').trim().toLowerCase();
  const [field, dir] = (q.get('sort') ?? '').split(':');

  let out = search ? rows.filter((r) => searchOf(r).toLowerCase().includes(search)) : [...rows];
  if (field) {
    out.sort((a, b) => {
      const x = String((a as unknown as Record<string, unknown>)[field] ?? '');
      const y = String((b as unknown as Record<string, unknown>)[field] ?? '');
      return dir === 'desc' ? y.localeCompare(x) : x.localeCompare(y);
    });
  }
  const total = out.length;
  out = out.slice((page - 1) * pageSize, page * pageSize);
  return { data: out, total };
}

export interface CrudOptions<T> {
  inUse?: (id: number) => boolean;
  duplicate?: (body: Omit<T, 'id'>, ignoreId: number) => string | null;
}

export function crud<T extends { id: number }>(
  path: string,
  rows: T[],
  searchOf: (r: T) => string,
  opts: CrudOptions<T> = {},
): Record<string, FixtureHandler> {
  return {
    [`GET /${path}`]: (req) => ok(paged(rows, req.url, searchOf)),
    [`GET /${path}/:id`]: (req) => {
      const row = rows.find((r) => r.id === idOf(req.url));
      return row ? ok(row) : fail(404, 'Not found.');
    },
    [`POST /${path}`]: (req) => {
      const body = req.body as Omit<T, 'id'>;
      const dup = opts.duplicate?.(body, 0);
      if (dup) return fail(422, dup);
      const row = { ...body, id: nextId(rows) } as T;
      rows.push(row);
      return ok(row);
    },
    [`PUT /${path}/:id`]: (req) => {
      const id = idOf(req.url);
      const i = rows.findIndex((r) => r.id === id);
      if (i < 0) return fail(404, 'Not found.');
      const body = req.body as Omit<T, 'id'>;
      const dup = opts.duplicate?.(body, id);
      if (dup) return fail(422, dup);
      rows[i] = { ...body, id } as T;
      return ok(rows[i]);
    },
    [`DELETE /${path}/:id`]: (req) => {
      const id = idOf(req.url);
      const i = rows.findIndex((r) => r.id === id);
      if (i < 0) return fail(404, 'Not found.');
      if (opts.inUse?.(id)) return fail(409, 'This record is in use and cannot be deleted.');
      rows.splice(i, 1);
      return ok();
    },
  };
}

const sameName = <T extends { id: number; name: string }>(rows: T[]) =>
  (body: Omit<T, 'id'>, ignoreId: number) =>
    rows.some((r) => r.id !== ignoreId && r.name.toLowerCase() === body.name.trim().toLowerCase())
      ? 'This name already exists.'
      : null;

export const PRODUCT_FIXTURES: Record<string, FixtureHandler> = {
  ...crud('products', products, (p) => `${p.sku} ${p.name} ${p.barcode ?? ''}`, {
    duplicate: (b, ignoreId) =>
      products.some((p) => p.id !== ignoreId && p.sku.toLowerCase() === b.sku.trim().toLowerCase())
        ? 'This SKU already exists.'
        : null,
  }),
  ...crud('brands', brands, (b) => b.name, {
    inUse: (id) => products.some((p) => p.brandId === id),
    duplicate: sameName(brands),
  }),
  ...crud('categories', categories, (c) => c.name, {
    inUse: (id) => products.some((p) => p.categoryId === id) || categories.some((c) => c.parentId === id),
    duplicate: categoryError,
  }),
};
