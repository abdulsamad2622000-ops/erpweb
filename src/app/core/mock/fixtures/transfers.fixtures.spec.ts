import { describe, expect, it } from 'vitest';
import { SerialDetail } from '../../../features/inventory/models/inventory.models';
import { Transfer } from '../../../features/inventory/models/transfer.models';
import { Grn } from '../../../features/purchase/models/purchase.models';
import { PURCHASE_FIXTURES as F } from './purchase.fixtures';
import { STOCK_FIXTURES as S } from './stock.fixtures';
import { TRANSFER_FIXTURES as T } from './transfers.fixtures';

const req = (method: string, url: string, body: unknown = null) => ({ method, url, body });
const SERIALS = ['5CG3000001', '5CG3000002', '5CG3000003'];
const where = (s: string): number =>
  (S['GET /inventory/serials/:id'](req('GET', `/api/v1/inventory/serials/${s}`)).body as SerialDetail).warehouseId;
const act = (id: number, a: string, body: unknown = {}) =>
  T[`POST /inventory/transfers/:id/${a}`](req('POST', `/api/v1/inventory/transfers/${id}/${a}`, body));

describe('transfers flow', () => {
  it('request, approve, dispatch and receive with a missing serial', () => {
    const g = F['POST /purchase/grns'](req('POST', '/api/v1/purchase/grns', { poId: 1 })).body as Grn;
    const lines = g.lines.map((l) =>
      l.productId === 1 ? { ...l, serials: SERIALS.map((serial) => ({ serial, productId: 1, status: 'accepted', note: null })) } : l);
    expect(F['POST /purchase/grns/:id/post'](req('POST', `/api/v1/purchase/grns/${g.id}/post`, { lines })).status).toBe(200);
    const from = where(SERIALS[0]);
    const to = from === 2 ? 1 : 2;

    expect(T['POST /inventory/transfers'](req('POST', '/api/v1/inventory/transfers', { fromWarehouseId: from, toWarehouseId: from, serials: SERIALS, note: null })).status).toBe(422);
    const made = T['POST /inventory/transfers'](req('POST', '/api/v1/inventory/transfers', { fromWarehouseId: from, toWarehouseId: to, serials: SERIALS, note: null }));
    expect(made.status).toBe(200);
    const t = made.body as Transfer;
    expect(t.status).toBe('requested');
    expect(T['POST /inventory/transfers'](req('POST', '/api/v1/inventory/transfers', { fromWarehouseId: from, toWarehouseId: to, serials: [SERIALS[0]], note: null })).status).toBe(422);

    expect(act(t.id, 'dispatch').status).toBe(409);
    expect(act(t.id, 'approve').status).toBe(200);
    expect(act(t.id, 'dispatch').status).toBe(200);
    expect(where(SERIALS[0])).toBe(0);

    expect(act(t.id, 'receive', { serials: [] }).status).toBe(422);
    const done = act(t.id, 'receive', { serials: [SERIALS[0], SERIALS[1]] });
    expect(done.status).toBe(200);
    expect(where(SERIALS[0])).toBe(to);
    expect(where(SERIALS[2])).toBe(0);
  });

  it('reject needs a reason', () => {
    const list = T['GET /inventory/transfers'](req('GET', '/api/v1/inventory/transfers')).body as Transfer[];
    expect(list.length).toBeGreaterThan(0);
    expect(T['GET /inventory/transfers/:id'](req('GET', '/api/v1/inventory/transfers/999')).status).toBe(404);
  });
});