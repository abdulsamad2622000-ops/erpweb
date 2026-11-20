import { describe, expect, it } from 'vitest';
import { LedgerEntry, SupplierPayment } from '../../../features/purchase/models/payables.models';
import { outstanding } from '../../../features/purchase/utils/payables-utils';
import { PAYABLES_FIXTURES as F } from './payables.fixtures';

const req = (method: string, url: string, body: unknown = null) => ({ method, url, body });
const owed = (id: number): number =>
  outstanding((F['GET /purchase/suppliers/:id/ledger'](req('GET', `/api/v1/purchase/suppliers/${id}/ledger`)).body as { entries: LedgerEntry[] }).entries);

describe('payables fixtures', () => {
  it('ledger starts with the opening balance', () => {
    const entries = (F['GET /purchase/suppliers/:id/ledger'](req('GET', '/api/v1/purchase/suppliers/1/ledger')).body as { entries: LedgerEntry[] }).entries;
    expect(entries.find((e) => e.type === 'opening')?.increase).toBe(250000);
  });

  it('rejects a payment above what is owed or with a bad amount', () => {
    const base = { supplierId: 1, date: '2026-11-20', method: 'cash', reference: 'R1', note: null };
    expect(F['POST /purchase/payments'](req('POST', '/api/v1/purchase/payments', { ...base, amount: 999999999 })).status).toBe(422);
    expect(F['POST /purchase/payments'](req('POST', '/api/v1/purchase/payments', { ...base, amount: 0 })).status).toBe(422);
  });

  it('a payment lowers the amount owed and is listed', () => {
    const before2 = owed(2);
    const res = F['POST /purchase/payments'](req('POST', '/api/v1/purchase/payments', {
      supplierId: 2, date: '2026-11-20', amount: 40000, method: 'bank_transfer', reference: 'TT-77', note: null,
    }));
    expect(res.status).toBe(200);
    expect(owed(2)).toBe(before2 - 40000);
    const list = F['GET /purchase/payments'](req('GET', '/api/v1/purchase/payments?supplierId=2')).body as SupplierPayment[];
    expect(list[0].reference).toBe('TT-77');
  });

  it('landed cost needs an existing, posted GRN', () => {
    expect(F['GET /purchase/grns/:id/landed-cost'](req('GET', '/api/v1/purchase/grns/999/landed-cost')).status).toBe(404);
    expect(F['PUT /purchase/grns/:id/landed-cost'](req('PUT', '/api/v1/purchase/grns/999/landed-cost', { items: [] })).status).toBe(404);
  });

  it('return rules: unknown serial, short reason, no serials', () => {
    expect(F['GET /purchase/returns/serial/:id'](req('GET', '/api/v1/purchase/returns/serial/NOPE1234')).status).toBe(404);
    expect(F['POST /purchase/returns'](req('POST', '/api/v1/purchase/returns', { supplierId: 1, serials: ['X1'], reason: 'short' })).status).toBe(422);
    expect(F['POST /purchase/returns'](req('POST', '/api/v1/purchase/returns', { supplierId: 1, serials: [], reason: 'Faulty panel on arrival' })).status).toBe(422);
  });

  it('bill needs something received first', () => {
    const res = F['POST /purchase/orders/:id/bill'](req('POST', '/api/v1/purchase/orders/2/bill', { number: 'B1', billDate: '2026-11-20', amount: 500 }));
    expect(res.status).toBe(409);
  });
});