import { describe, expect, it } from 'vitest';
import { binCounts, serialsInBin } from './bin-utils';

const s = (serial: string, binId?: number | null) => ({ serial, binId });

describe('bin utils', () => {
  const list = [s('A', 4), s('B', 4), s('C', 5), s('D'), s('E', null)];

  it('counts serials per bin and ignores serials without a bin', () => {
    const counts = binCounts(list);
    expect(counts.get(4)).toBe(2);
    expect(counts.get(5)).toBe(1);
    expect(counts.size).toBe(2);
  });

  it('lists the serials of one bin', () => {
    expect(serialsInBin(list, 4).map((x) => x.serial)).toEqual(['A', 'B']);
    expect(serialsInBin(list, 99)).toEqual([]);
  });

  it('bin 0 means serials with no bin yet', () => {
    expect(serialsInBin(list, 0).map((x) => x.serial)).toEqual(['D', 'E']);
  });
});