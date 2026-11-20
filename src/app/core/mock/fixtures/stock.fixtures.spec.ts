import { describe, expect, it } from 'vitest';
import {
  SerialDetail, StockLedgerRow, StockSerial, StockSummaryRow,
} from '../../../features/inventory/models/inventory.models';
import { Grn } from '../../../features/purchase/models/purchase.models';
import { PAYABLES_FIXTURES as P } from './payables.fixtures';
import { PURCHASE_FIXTURES as F } from './purchase.fixtures';
import { STOCK_FIXTURES as S } from './stock.fixtures';

const req = (method: string, url: string, body: unknown = null) => ({ method, url, body });
const SERIAL = '5CG2000001';

describe('stock fixtures', () => {
  it('has no stock before anything is received', () => {
    expect((S['GET /inventory/serials'](req('GET', '/api/v1/inventory/serials?q=&status=')).body as StockSerial[]).length).toBe(0);
  });

  it('a posted GRN adds stock, and a return moves it out', () => {
    const g = F['POST /purchase/grns'](req('POST', '/api/v1/purchase/grns', { poId: 1 })).body as Grn;
    const lines = g.lines.map((l) =>
      l.productId === 1 ? { ...l, serials: [{ serial: SERIAL, productId: 1, status: 'accepted', note: null }] } : l);
    expect(F['POST /purchase/grns/:id/post'](req('POST', `/api/v1/purchase/grns/${g.id}/post`, { lines })).status).toBe(200);

    const sum = S['GET /inventory/stock'](req('GET', '/api/v1/inventory/stock')).body as StockSummaryRow[];
    expect(sum.find((r) => r.productId === 1)?.inStock).toBe(1);

    const found = S['GET /inventory/serials'](req('GET', '/api/v1/inventory/serials?q=2000001&status=in_stock')).body as StockSerial[];
    expect(found.map((x) => x.serial)).toEqual([SERIAL]);

    P['POST /purchase/returns'](req('POST', '/api/v1/purchase/returns', { supplierId: 1, serials: [SERIAL], reason: 'Faulty panel on arrival' }));
    const detail = S['GET /inventory/serials/:id'](req('GET', `/api/v1/inventory/serials/${SERIAL}`)).body as SerialDetail;
    expect(detail.status).toBe('returned');
    expect(detail.timeline.map((t) => t.type)).toEqual(['received', 'returned']);

    const ledger = S['GET /inventory/ledger'](req('GET', '/api/v1/inventory/ledger')).body as StockLedgerRow[];
    expect(ledger.map((r) => r.direction).sort()).toEqual(['in', 'out']);
  });

  it('unknown serial gives 404', () => {
    expect(S['GET /inventory/serials/:id'](req('GET', '/api/v1/inventory/serials/NOPE')).status).toBe(404);
  });
});