import { Product } from '../../products/models';
import { Warehouse } from '../../settings/models/org.models';
import { StockSerial, StockSummaryRow } from '../models/inventory.models';

/** Is se purana maal "aging" kehlata hai. */
export const AGING_OLD_DAYS = 90;
const DAY_MS = 86_400_000;

export interface LowStockRow {
  productId: number;
  name: string;
  sku: string;
  branchId: number;
  inStock: number;
  level: number;
  /** Reorder level tak pahunchne ke liye kitne kam hain (0 = bilkul level par). */
  short: number;
  out: boolean;
}

type ProductLike = Pick<Product, 'id' | 'name' | 'sku' | 'isActive' | 'reorderLevels'>;

/**
 * Har product aur har branch (jis ka reorder level set hai) ke liye, branch ke warehouses mein
 * in-stock count ginta hai. Count level ke barabar ya kam ho to row banti hai.
 * Raaste mein (warehouse 0) ya anjaan warehouse ka maal kisi branch mein nahi ginta.
 */
export function lowStockRows(
  products: readonly ProductLike[],
  warehouses: readonly Pick<Warehouse, 'id' | 'branchId'>[],
  stock: readonly Pick<StockSummaryRow, 'productId' | 'warehouseId' | 'inStock'>[],
): LowStockRow[] {
  const branchOf = new Map<number, number>(warehouses.map((w) => [w.id, w.branchId] as [number, number]));
  const have = new Map<string, number>();
  for (const r of stock) {
    const branch = branchOf.get(r.warehouseId);
    if (branch === undefined) continue;
    const key = `${r.productId}:${branch}`;
    have.set(key, (have.get(key) ?? 0) + r.inStock);
  }

  const rows: LowStockRow[] = [];
  for (const p of products) {
    if (!p.isActive) continue;
    for (const rl of p.reorderLevels ?? []) {
      const inStock = have.get(`${p.id}:${rl.branchId}`) ?? 0;
      if (inStock <= rl.level) {
        rows.push({
          productId: p.id,
          name: p.name,
          sku: p.sku,
          branchId: rl.branchId,
          inStock,
          level: rl.level,
          short: rl.level - inStock,
          out: inStock === 0,
        });
      }
    }
  }
  return rows.sort(
    (a, b) =>
      Number(b.out) - Number(a.out) ||
      b.short - a.short ||
      a.name.localeCompare(b.name) ||
      a.branchId - b.branchId,
  );
}

export type AgeBucket = 'd0_30' | 'd31_60' | 'd61_90' | 'd90_plus';

/** Receive hue kitne poore din ho gaye. Galat ya mustaqbil ki tareekh 0 maani jati hai. */
export function ageInDays(receivedAt: string, now: Date): number {
  const t = Date.parse(receivedAt);
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((now.getTime() - t) / DAY_MS));
}

export function ageBucket(days: number): AgeBucket {
  if (days <= 30) return 'd0_30';
  if (days <= 60) return 'd31_60';
  if (days <= AGING_OLD_DAYS) return 'd61_90';
  return 'd90_plus';
}

export interface AgingRow {
  productId: number;
  name: string;
  sku: string;
  warehouseId: number;
  d0_30: number;
  d31_60: number;
  d61_90: number;
  d90_plus: number;
  total: number;
  /** Sab se purane serial ki umar (din). */
  oldest: number;
}

/** Sirf in_stock serials, product aur warehouse ke hisaab se umar ke buckets mein. */
export function agingRows(
  serials: readonly Pick<StockSerial, 'productId' | 'name' | 'sku' | 'warehouseId' | 'status' | 'receivedAt'>[],
  now: Date,
): AgingRow[] {
  const map = new Map<string, AgingRow>();
  for (const s of serials) {
    if (s.status !== 'in_stock') continue;
    const key = `${s.productId}:${s.warehouseId}`;
    let row = map.get(key);
    if (!row) {
      row = {
        productId: s.productId,
        name: s.name,
        sku: s.sku,
        warehouseId: s.warehouseId,
        d0_30: 0,
        d31_60: 0,
        d61_90: 0,
        d90_plus: 0,
        total: 0,
        oldest: 0,
      };
      map.set(key, row);
    }
    const days = ageInDays(s.receivedAt, now);
    row[ageBucket(days)]++;
    row.total++;
    row.oldest = Math.max(row.oldest, days);
  }
  return [...map.values()].sort(
    (a, b) => b.d90_plus - a.d90_plus || b.oldest - a.oldest || a.name.localeCompare(b.name),
  );
}