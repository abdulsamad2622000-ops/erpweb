import { Brand, Category, Product } from '../../../features/products/models';
import { FixtureHandler, fail, ok } from './fixture.types';

const brands: Brand[] = [
  { id: 1, name: 'Dell', isActive: true },
  { id: 2, name: 'HP', isActive: true },
  { id: 3, name: 'Lenovo', isActive: true },
];

const categories: Category[] = [
  { id: 1, name: 'Laptops', isActive: true },
  { id: 2, name: 'Desktops', isActive: true },
  { id: 3, name: 'Accessories', isActive: true },
];

const products: Product[] = [
  { id: 1, sku: 'LAP-DELL-001', name: 'Dell Latitude 5440', barcode: '8901000000011', brandId: 1, categoryId: 1, trackBatch: false, isActive: true },
  { id: 2, sku: 'LAP-HP-001', name: 'HP ProBook 450', barcode: null, brandId: 2, categoryId: 1, trackBatch: false, isActive: true },
  { id: 3, sku: 'ACC-LEN-001', name: 'Lenovo Wireless Mouse', barcode: '8901000000033', brandId: 3, categoryId: 3, trackBatch: true, isActive: true },
];

const idOf = (url: string): number => Number(url.split('?')[0].split('/').pop());
const nextId = (rows: { id: number }[]): number => Math.max(0, ...rows.map((r) => r.id)) + 1;

function paged<T>(rows: T[], url: string, searchOf: (r: T) => string) {
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

interface CrudOptions<T> {
  inUse?: (id: number) => boolean;
  duplicate?: (body: Omit<T, 'id'>, ignoreId: number) => string | null;
}

function crud<T extends { id: number }>(
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
    inUse: (id) => products.some((p) => p.categoryId === id),
    duplicate: sameName(categories),
  }),
};
