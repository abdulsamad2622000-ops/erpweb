import { describe, expect, it } from 'vitest';
import { StockStatus } from '../models/inventory.models';
import { ageBucket, ageInDays, agingRows, lowStockRows } from './alert-utils';

const WAREHOUSES = [
  { id: 10, branchId: 1 },
  { id: 11, branchId: 1 },
  { id: 20, branchId: 2 },
];
const product = (id: number, name: string, reorderLevels: { branchId: number; level: number }[], isActive = true) => ({
  id, name, sku: `SKU-${id}`, isActive, reorderLevels,
});
const have = (productId: number, warehouseId: number, inStock: number) => ({ productId, warehouseId, inStock });

describe('lowStockRows', () => {
  it('adds up the stock of all warehouses of a branch and flags at or below the level', () => {
    const rows = lowStockRows(
      [product(1, 'Dell', [{ branchId: 1, level: 5 }])],
      WAREHOUSES,
      [have(1, 10, 2), have(1, 11, 3), have(1, 20, 50)],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ productId: 1, branchId: 1, inStock: 5, level: 5, short: 0, out: false });
  });

  it('does not flag a product that is above its level', () => {
    expect(
      lowStockRows([product(1, 'Dell', [{ branchId: 1, level: 5 }])], WAREHOUSES, [have(1, 10, 6)]),
    ).toEqual([]);
  });

  it('flags a branch with no stock row as out of stock', () => {
    const rows = lowStockRows([product(1, 'Dell', [{ branchId: 2, level: 3 }])], WAREHOUSES, [have(1, 10, 9)]);
    expect(rows[0]).toMatchObject({ branchId: 2, inStock: 0, short: 3, out: true });
  });

  it('ignores stock in transit or in unknown warehouses', () => {
    const rows = lowStockRows(
      [product(1, 'Dell', [{ branchId: 1, level: 2 }])],
      WAREHOUSES,
      [have(1, 0, 40), have(1, 99, 40)],
    );
    expect(rows[0]).toMatchObject({ inStock: 0, out: true });
  });

  it('skips inactive products and products without reorder levels', () => {
    expect(
      lowStockRows(
        [product(1, 'Old', [{ branchId: 1, level: 5 }], false), product(2, 'No level', [])],
        WAREHOUSES,
        [],
      ),
    ).toEqual([]);
  });

  it('level 0 alerts only when the stock is 0', () => {
    const p = [product(1, 'Dell', [{ branchId: 1, level: 0 }])];
    expect(lowStockRows(p, WAREHOUSES, [have(1, 10, 1)])).toEqual([]);
    expect(lowStockRows(p, WAREHOUSES, [])).toHaveLength(1);
  });

  it('lists out of stock first, then the biggest shortage', () => {
    const rows = lowStockRows(
      [
        product(1, 'Bravo', [{ branchId: 1, level: 10 }]),
        product(2, 'Alpha', [{ branchId: 1, level: 4 }]),
        product(3, 'Charlie', [{ branchId: 1, level: 2 }]),
      ],
      WAREHOUSES,
      [have(1, 10, 3), have(2, 10, 2), have(3, 10, 0)],
    );
    expect(rows.map((r) => r.name)).toEqual(['Charlie', 'Bravo', 'Alpha']);
  });
});

describe('age helpers', () => {
  const now = new Date('2026-11-21T00:00:00Z');

  it('counts whole days and treats bad or future dates as 0', () => {
    expect(ageInDays('2026-11-11T00:00:00Z', now)).toBe(10);
    expect(ageInDays('2026-11-20T12:00:00Z', now)).toBe(0);
    expect(ageInDays('2027-01-01T00:00:00Z', now)).toBe(0);
    expect(ageInDays('not a date', now)).toBe(0);
  });

  it('puts the days into the right bucket', () => {
    expect(ageBucket(0)).toBe('d0_30');
    expect(ageBucket(30)).toBe('d0_30');
    expect(ageBucket(31)).toBe('d31_60');
    expect(ageBucket(60)).toBe('d31_60');
    expect(ageBucket(61)).toBe('d61_90');
    expect(ageBucket(90)).toBe('d61_90');
    expect(ageBucket(91)).toBe('d90_plus');
  });
});

describe('agingRows', () => {
  const now = new Date('2026-11-21T00:00:00Z');
  const ago = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
  const s = (productId: number, warehouseId: number, days: number, status: StockStatus = 'in_stock') => ({
    productId, name: `P${productId}`, sku: `SKU-${productId}`, warehouseId, status, receivedAt: ago(days),
  });

  it('groups by product and warehouse and counts each bucket', () => {
    const rows = agingRows([s(1, 10, 5), s(1, 10, 40), s(1, 10, 75), s(1, 10, 200), s(1, 11, 5)], now);
    const main = rows.find((r) => r.warehouseId === 10);
    expect(main).toMatchObject({ d0_30: 1, d31_60: 1, d61_90: 1, d90_plus: 1, total: 4, oldest: 200 });
    expect(rows.find((r) => r.warehouseId === 11)).toMatchObject({ total: 1, d0_30: 1 });
  });

  it('counts only in-stock serials', () => {
    expect(agingRows([s(1, 10, 5, 'quarantine'), s(1, 10, 5, 'damaged'), s(1, 10, 5, 'returned')], now)).toEqual([]);
  });

  it('lists the rows with the most old stock first', () => {
    const rows = agingRows([s(1, 10, 10), s(2, 10, 120), s(2, 10, 130), s(3, 10, 95)], now);
    expect(rows.map((r) => r.productId)).toEqual([2, 3, 1]);
  });
});