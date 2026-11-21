import { describe, expect, it } from 'vitest';
import { expenseProblem, runningBalance } from './accounts-utils';

describe('accounts utils', () => {
  it('validates expense', () => {
    expect(expenseProblem({}, '2026-11-21')).toBe('expensesPage.errors.date');
    expect(expenseProblem({ date: '2026-11-22' }, '2026-11-21')).toBe('expensesPage.errors.future');
    expect(expenseProblem({ date: '2026-11-21' }, '2026-11-21')).toBe('expensesPage.errors.category');
    expect(expenseProblem({ date: '2026-11-21', categoryId: 1, amount: 0 }, '2026-11-21')).toBe('expensesPage.errors.amount');
    expect(expenseProblem({ date: '2026-11-21', categoryId: 1, amount: 500 }, '2026-11-21')).toBeNull();
  });
  it('running balance', () => {
    const r = runningBalance(100, [
      { at: 'a', type: 'sale', ref: 'x', method: 'cash', in: 50, out: 0, note: null },
      { at: 'b', type: 'expense', ref: 'y', method: 'cash', in: 0, out: 30.5, note: null },
    ]);
    expect(r.map((x) => x.balance)).toEqual([150, 119.5]);
  });
});
