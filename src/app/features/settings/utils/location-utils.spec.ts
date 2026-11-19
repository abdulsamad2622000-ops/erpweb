import { describe, expect, it } from 'vitest';
import { WarehouseLocation } from '../models/location.models';
import { binBarcode, flattenTree, nextLevel, pathOf } from './location-utils';

const loc = (id: number, parentId: number | null, level: WarehouseLocation['level'], code: string): WarehouseLocation => ({
  id, warehouseId: 1, parentId, level, code, name: code, barcode: null, isActive: true,
});

const rows = [loc(1, null, 'zone', 'A'), loc(2, 1, 'rack', 'R2'), loc(3, 1, 'rack', 'R10'), loc(4, 2, 'shelf', 'S1')];

describe('location-utils', () => {
  it('nextLevel goes zone, rack, shelf, bin and stops', () => {
    expect(nextLevel(null)).toBe('zone');
    expect(nextLevel('zone')).toBe('rack');
    expect(nextLevel('shelf')).toBe('bin');
    expect(nextLevel('bin')).toBeNull();
  });

  it('flattenTree sorts naturally, sets depth and hides collapsed children', () => {
    const all = flattenTree(rows, new Set<number>());
    expect(all.map((t) => t.row.code)).toEqual(['A', 'R2', 'S1', 'R10']);
    expect(all[2].depth).toBe(2);
    expect(all[0].hasChildren).toBe(true);
    expect(flattenTree(rows, new Set([1])).map((t) => t.row.code)).toEqual(['A']);
  });

  it('pathOf and binBarcode build the bin code', () => {
    const codes = pathOf(rows, rows[3]).map((p) => p.code);
    expect(codes).toEqual(['A', 'R2', 'S1']);
    expect(binBarcode('lhr-sell', codes)).toBe('BIN-LHR-SELL-A-R2-S1');
  });
});