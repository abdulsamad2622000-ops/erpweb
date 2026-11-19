import { describe, expect, it } from 'vitest';
import { Category } from '../models';
import { categoryPaths } from './category-path';
import { duplicateSkus, floorViolations, formatMoney, priceFor, retailPrice, specSummary } from './product-utils';

describe('specSummary', () => {
  it('joins cpu, ram and storage and skips empty ones', () => {
    expect(specSummary({ cpu: 'Intel Core i5', ram: '16 GB', storage: '512 GB SSD', gpu: '', screen: '' })).toBe(
      'Intel Core i5 / 16 GB / 512 GB SSD',
    );
    expect(specSummary({ cpu: ' ', ram: '8 GB', storage: '' })).toBe('8 GB');
  });

  it('returns an empty string when there are no specs', () => {
    expect(specSummary(undefined)).toBe('');
    expect(specSummary(null)).toBe('');
  });
});

describe('categoryPaths', () => {
  const cat = (id: number, name: string, parentId: number | null): Category => ({ id, name, parentId, isActive: true });

  it('builds the full path of each category', () => {
    const map = categoryPaths([cat(1, 'Laptops', null), cat(2, 'Business', 1), cat(3, 'Ultra', 2)]);
    expect(map.get(1)).toBe('Laptops');
    expect(map.get(3)).toBe('Laptops \u203A Business \u203A Ultra');
  });

  it('treats a missing parent as top level', () => {
    expect(categoryPaths([cat(9, 'Orphan', 99)]).get(9)).toBe('Orphan');
  });
});

describe('prices', () => {
  const p = { prices: [{ tier: 'retail' as const, price: 165000 }, { tier: 'dealer' as const, price: 151000 }] };

  it('finds the price of a tier or null', () => {
    expect(priceFor(p, 'dealer')).toBe(151000);
    expect(priceFor(p, 'wholesale')).toBeNull();
    expect(priceFor({}, 'retail')).toBeNull();
  });

  it('retailPrice is the retail tier', () => {
    expect(retailPrice(p)).toBe(165000);
  });

  it('formats money with separators and a dash for nothing', () => {
    expect(formatMoney(165000)).toBe('165,000');
    expect(formatMoney(null)).toBe('-');
    expect(formatMoney(undefined)).toBe('-');
  });
});

describe('floorViolations', () => {
  it('lists the tiers below the minimum price', () => {
    expect(floorViolations(100, { retail: 150, wholesale: 90, dealer: 80 })).toEqual(['wholesale', 'dealer']);
  });

  it('allows a price equal to the floor and ignores empty prices', () => {
    expect(floorViolations(100, { retail: 100, wholesale: null })).toEqual([]);
  });

  it('has no floor when minPrice is empty', () => {
    expect(floorViolations(null, { retail: 1 })).toEqual([]);
  });
});

describe('duplicateSkus', () => {
  it('finds repeated SKUs ignoring case and spaces', () => {
    expect(duplicateSkus(['A-1', ' a-1 ', 'B-2', ''])).toEqual(new Set(['a-1']));
  });

  it('returns nothing when all are different or empty', () => {
    expect(duplicateSkus(['A', 'B', '', ' '])).toEqual(new Set());
  });
});