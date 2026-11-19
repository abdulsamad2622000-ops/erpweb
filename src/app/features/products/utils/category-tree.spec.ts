import { describe, expect, it } from 'vitest';
import { Category } from '../models';
import { descendantIds, flattenCategories } from './category-tree';

const cat = (id: number, name: string, parentId: number | null): Category => ({ id, name, parentId, isActive: true });
const rows = [cat(1, 'Laptops', null), cat(2, 'Gaming', 1), cat(3, 'Business', 1), cat(4, 'Desktops', null), cat(5, 'Ultra', 3)];

describe('category-tree', () => {
  it('flattens in tree order, sorted by name, with depth', () => {
    const all = flattenCategories(rows, new Set<number>());
    expect(all.map((t) => t.row.name)).toEqual(['Desktops', 'Laptops', 'Business', 'Ultra', 'Gaming']);
    expect(all.find((t) => t.row.id === 5)?.depth).toBe(2);
    expect(all.find((t) => t.row.id === 1)?.hasChildren).toBe(true);
  });

  it('hides the children of a collapsed category', () => {
    expect(flattenCategories(rows, new Set([1])).map((t) => t.row.name)).toEqual(['Desktops', 'Laptops']);
  });

  it('shows a category with a missing parent at the top', () => {
    expect(flattenCategories([cat(9, 'Orphan', 99)], new Set<number>())[0].depth).toBe(0);
  });

  it('finds all descendants', () => {
    expect(descendantIds(rows, 1).sort()).toEqual([2, 3, 5]);
    expect(descendantIds(rows, 4)).toEqual([]);
  });
});