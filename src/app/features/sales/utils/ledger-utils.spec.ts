import { describe, expect, it } from 'vitest';
import { allocationProblem, daysLate, fifoAllocate } from './ledger-utils';

const open = [
  { id: 2, number: 'B', date: '2026-02-01', dueDate: '2026-03-01', total: 50000, balance: 40000 },
  { id: 1, number: 'A', date: '2026-01-01', dueDate: '2026-02-01', total: 100000, balance: 100000 },
];

describe('ledger utils', () => {
  it('allocates oldest first', () => {
    expect(fifoAllocate(open, 120000)).toEqual([{ invoiceId: 1, amount: 100000 }, { invoiceId: 2, amount: 20000 }]);
  });
  it('checks manual allocations', () => {
    expect(allocationProblem(open, 0, {})).toBe('ledgerPage.errors.amount');
    expect(allocationProblem(open, 200000, {})).toBe('ledgerPage.errors.overDue');
    expect(allocationProblem(open, 5000, {})).toBeNull();
    expect(allocationProblem(open, 5000, { 2: 50000 })).toBe('ledgerPage.errors.overInvoice');
    expect(allocationProblem(open, 5000, { 2: 4000 })).toBe('ledgerPage.errors.notMatching');
    expect(allocationProblem(open, 5000, { 2: 5000 })).toBeNull();
  });
  it('counts late days', () => {
    expect(daysLate('2026-01-01', '2026-01-31')).toBe(30);
    expect(daysLate('2026-02-01', '2026-01-31')).toBe(0);
    expect(daysLate(null)).toBe(0);
  });
});
