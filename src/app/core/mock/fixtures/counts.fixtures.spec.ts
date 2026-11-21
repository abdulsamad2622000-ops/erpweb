import { describe, expect, it } from 'vitest';
import { SerialDetail } from '../../../features/inventory/models/inventory.models';
import { StockCount } from '../../../features/inventory/models/count.models';
import { Grn } from '../../../features/purchase/models/purchase.models';
import { COUNT_FIXTURES as C } from './counts.fixtures';
import { PURCHASE_FIXTURES as F } from './purchase.fixtures';
import { STOCK_FIXTURES as S } from './stock.fixtures';

const req = (method: string, url: string, body: unknown = null) => ({ method, url, body });
const SERIALS = ['5CG4000001', '5CG4000002', '5CG4000003'];
const make = (warehouseId: number) => C['POST /inventory/counts'](req('POST', '/api/v1/inventory/counts', { warehouseId, note: null }));
const act = (id: number, a: string, body: unknown = {}) =>
  C[`POST /inventory/counts/:id/${a}`](req('POST', `/api/v1/inventory/counts/${id}/${a}`, body));

describe('stock counts flow', () => {
  it('counts a warehouse, finds the difference and approves it', () => {
    const nothing = make(999);
    expect(nothing.status).toBe(422);

    const g = F['POST /purchase/grns'](req('POST', '/api/v1/purchase/grns', { poId: 1 })).body as Grn;
    const lines = g.lines.map((l) =>
      l.productId === 1 ? { ...l, serials: SERIALS.map((serial) => ({ serial, productId: 1, status: 'accepted', note: null })) } : l);
    expect(F['POST /purchase/grns/:id/post'](req('POST', `/api/v1/purchase/grns/${g.id}/post`, { lines })).status).toBe(200);
    const wh = (S['GET /inventory/serials/:id'](req('GET', `/api/v1/inventory/serials/${SERIALS[0]}`)).body as SerialDetail).warehouseId;

    const made = make(wh);
    expect(made.status).toBe(200);
    const c = made.body as StockCount;
    expect(c.status).toBe('open');
    expect(c.expected.map((l) => l.serial)).toEqual(expect.arrayContaining(SERIALS));
    expect(make(wh).status).toBe(422);

    expect(act(c.id, 'approve').status).toBe(409);
    expect(act(c.id, 'submit', { serials: [] }).status).toBe(422);
    expect(act(c.id, 'submit', { serials: ['NOPE-0000'] }).status).toBe(422);
    const sub = act(c.id, 'submit', { serials: [SERIALS[0], SERIALS[1], SERIALS[1]] });
    expect(sub.status).toBe(200);
    expect((sub.body as StockCount).counted.length).toBe(2);
    expect((sub.body as StockCount).status).toBe('submitted');

    expect(act(c.id, 'reject', { note: 'short' }).status).toBe(422);
    expect(act(c.id, 'approve').status).toBe(200);
    expect(act(c.id, 'reject', { note: 'Long enough reason' }).status).toBe(409);
  });

  it('lists counts and gives 404 for an unknown one', () => {
    expect((C['GET /inventory/counts'](req('GET', '/api/v1/inventory/counts')).body as StockCount[]).length).toBeGreaterThan(0);
    expect(C['GET /inventory/counts/:id'](req('GET', '/api/v1/inventory/counts/999')).status).toBe(404);
  });
});