import { describe, expect, it } from 'vitest';
import { LedgerEntry, PoMatching } from '../models/payables.models';
import {
  allocateLanded, ledgerWithBalance, matchStatus, outstanding, paymentAmountError, receivedValue,
} from './payables-utils';

const e = (id: string, date: string, increase: number, decrease: number): LedgerEntry => ({
  id, date, type: 'grn', ref: id, increase, decrease,
});

describe('ledger', () => {
  it('sorts by date and keeps a running balance', () => {
    const rows = ledgerWithBalance([e('b', '2026-11-05', 0, 30), e('a', '2026-11-01', 100, 0)]);
    expect(rows.map((r) => r.id)).toEqual(['a', 'b']);
    expect(rows.map((r) => r.balance)).toEqual([100, 70]);
  });
  it('outstanding is increases minus decreases', () => {
    expect(outstanding([e('a', '2026-11-01', 100, 0), e('b', '2026-11-02', 0, 40.5)])).toBe(59.5);
    expect(outstanding([])).toBe(0);
  });
});

describe('paymentAmountError', () => {
  it('rejects zero, negative and more than owed', () => {
    expect(paymentAmountError(0, 100)).toBe('invalid');
    expect(paymentAmountError(-5, 100)).toBe('invalid');
    expect(paymentAmountError(Number.NaN, 100)).toBe('invalid');
    expect(paymentAmountError(100.01, 100)).toBe('too_much');
    expect(paymentAmountError(100, 100)).toBeNull();
  });
});

describe('allocateLanded', () => {
  const lines = [
    { productId: 1, name: 'A', qty: 2, unitCost: 100 },
    { productId: 2, name: 'B', qty: 1, unitCost: 100 },
    { productId: 3, name: 'C', qty: 1, unitCost: 100 },
  ];
  it('shares add up exactly to the total', () => {
    const out = allocateLanded(lines, [{ label: 'Freight', amount: 100 }]);
    expect(out.reduce((s, l) => s + l.landedShare, 0)).toBeCloseTo(100, 2);
    expect(out[0].landedShare).toBe(50);
  });
  it('unit landed cost includes the share', () => {
    const out = allocateLanded(lines.slice(0, 1), [{ label: 'Freight', amount: 20 }]);
    expect(out[0].unitLanded).toBe(110);
  });
  it('no costs means no share', () => {
    expect(allocateLanded(lines, []).every((l) => l.landedShare === 0)).toBe(true);
  });
});

describe('matchStatus', () => {
  const base: PoMatching = {
    poId: 1, poNumber: 'PO-1', grnNumbers: [], bill: null,
    lines: [{ productId: 1, name: 'A', orderedQty: 10, receivedQty: 0, unitCost: 100 }],
  };
  it('not received, no bill, matched, mismatch', () => {
    expect(matchStatus(base)).toBe('not_received');
    const got = { ...base, lines: [{ ...base.lines[0], receivedQty: 4 }] };
    expect(receivedValue(got)).toBe(400);
    expect(matchStatus(got)).toBe('no_bill');
    expect(matchStatus({ ...got, bill: { poId: 1, number: 'B1', billDate: '2026-11-20', amount: 400 } })).toBe('matched');
    expect(matchStatus({ ...got, bill: { poId: 1, number: 'B1', billDate: '2026-11-20', amount: 1000 } })).toBe('mismatch');
  });
});