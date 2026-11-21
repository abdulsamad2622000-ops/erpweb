import { describe, expect, it } from 'vitest';
import { Grn } from '../../../features/purchase/models/purchase.models';
import {
  LandedCost, LedgerEntry, PoMatching, PurchaseReturn, ReturnableSerial,
} from '../../../features/purchase/models/payables.models';
import { matchStatus, outstanding, receivedValue } from '../../../features/purchase/utils/payables-utils';
import { PAYABLES_FIXTURES as P } from './payables.fixtures';
import { PURCHASE_FIXTURES as F } from './purchase.fixtures';

const req = (method: string, url: string, body: unknown = null) => ({ method, url, body });
const owed = (id: number): number =>
  outstanding((P['GET /purchase/suppliers/:id/ledger'](req('GET', `/api/v1/purchase/suppliers/${id}/ledger`)).body as { entries: LedgerEntry[] }).entries);

describe('receive, return, landed cost and matching flow', () => {
  const SERIAL = '5CG1000001';

  it('post a GRN, then it shows in the ledger, landed cost and matching', () => {
    const before = owed(1);
    const g = F['POST /purchase/grns'](req('POST', '/api/v1/purchase/grns', { poId: 1 })).body as Grn;
    const lines = g.lines.map((l) =>
      l.productId === 1 ? { ...l, serials: [{ serial: SERIAL, productId: 1, status: 'accepted', note: null }] } : l);
    const posted = F['POST /purchase/grns/:id/post'](req('POST', `/api/v1/purchase/grns/${g.id}/post`, { lines }));
    expect(posted.status).toBe(200);
    expect(owed(1)).toBe(before + 142000);

    const lc = P['PUT /purchase/grns/:id/landed-cost'](req('PUT', `/api/v1/purchase/grns/${g.id}/landed-cost`, { items: [{ label: 'Freight', amount: 10000 }] }));
    expect(lc.status).toBe(200);
    const read = P['GET /purchase/grns/:id/landed-cost'](req('GET', `/api/v1/purchase/grns/${g.id}/landed-cost`)).body as LandedCost;
    expect(read.items[0].amount).toBe(10000);

    const m = P['GET /purchase/orders/:id/matching'](req('GET', '/api/v1/purchase/orders/1/matching')).body as PoMatching;
    expect(matchStatus(m)).toBe('no_bill');
    P['POST /purchase/orders/:id/bill'](req('POST', '/api/v1/purchase/orders/1/bill', { number: 'B-1', billDate: '2026-11-20', amount: receivedValue(m) }));
    const m2 = P['GET /purchase/orders/:id/matching'](req('GET', '/api/v1/purchase/orders/1/matching')).body as PoMatching;
    expect(matchStatus(m2)).toBe('matched');
  });

  it('a received serial can be returned once and lowers the amount owed', () => {
    const before = owed(1);
    const r = P['GET /purchase/returns/serial/:id'](req('GET', `/api/v1/purchase/returns/serial/${SERIAL}`));
    expect(r.status).toBe(200);
    expect((r.body as ReturnableSerial).supplierId).toBe(1);

    const body = { supplierId: 1, serials: [SERIAL], reason: 'Faulty panel on arrival' };
    const ret = P['POST /purchase/returns'](req('POST', '/api/v1/purchase/returns', body));
    expect(ret.status).toBe(200);
    expect((ret.body as PurchaseReturn).total).toBe(142000);
    expect(owed(1)).toBe(before - 142000);

    expect(P['POST /purchase/returns'](req('POST', '/api/v1/purchase/returns', body)).status).toBe(422);
    expect(P['GET /purchase/returns/serial/:id'](req('GET', `/api/v1/purchase/returns/serial/${SERIAL}`)).status).toBe(409);
  });

  it('a return for the wrong supplier is rejected', () => {
    const res = P['POST /purchase/returns'](req('POST', '/api/v1/purchase/returns', { supplierId: 2, serials: ['5CG9999999'], reason: 'Wrong supplier test' }));
    expect(res.status).toBe(422);
  });
});