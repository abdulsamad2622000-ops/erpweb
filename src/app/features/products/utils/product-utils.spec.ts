import { describe, expect, it } from 'vitest';
import { Category } from '../models';
import { categoryPaths } from './category-path';
import { specSummary } from './product-utils';

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