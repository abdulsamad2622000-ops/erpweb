import { describe, expect, it } from 'vitest';
import { StockAdjustment } from '../../../features/inventory/models/adjustment.models';
import { SerialDetail, StockSummaryRow } from '../../../features/inventory/models/inventory.models';
import { Grn } from '../../../features/purchase/models/purchase.models';
import { ADJUSTMENT_FIXTURES as A } from './adjustments.fixtures';
import { PURCHASE_FIXTURES as F } from './purchase.fixtures';
import { STOCK_FIXTURES as S } from './stock.fixtures';

const req = (method: string, url: string, body: unknown = null) => ({ method, url, body });
const SERIALS = ['5CG6000001', '5CG6000002'];
const REASON = 'Checked on the shelf today';
const make = (kind: string, serials: string[], reason = REASON) =>
  A['POST /inventory/adjustments'](req('POST', '/api/v1/inventory/adjustments', { kind, serials, reason }));
const act = (id: number, a: string, body: unknown = {}) =>
  A[`POST /inventory/adjustments/:id/${a}`](req('POST', `/api/v1/inventory/adjustments/${id}/${a}`, body));
const detail = (serial: string) =>
  S['GET /inventory/serials/:id'](req('GET', `/api/v1/inventory/serials/${serial}`)).body as SerialDetail;
const damagedTotal = (): number =>
  (S['GET /inventory/stock'](req('GET', '/api/v1/inventory/stock')).body as StockSummaryRow[]).reduce((n, r) => n + r.damaged, 0);

describe('stock adjustments flow', () => {
  it('quarantine, release and damage change the stock only after approval', () => {
    const g = F['POST /purchase/grns'](req('POST', '/api/v1/purchase/grns', { poId: 1 })).body as Grn;
    const lines = g.lines.map((l) =>
      l.productId === 1 ? { ...l, serials: SERIALS.map((serial) => ({ serial, productId: 1, status: 'accepted', note: null })) } : l);
    expect(F['POST /purchase/grns/:id/post'](req('POST', `/api/v1/purchase/grns/${g.id}/post`, { lines })).status).toBe(200);

    expect(make('quarantine', SERIALS, 'short').status).toBe(422);
    expect(make('quarantine', ['NOPE-0000']).status).toBe(422);
    expect(make('release', SERIALS).status).toBe(422);

    const q = make('quarantine', SERIALS);
    expect(q.status).toBe(200);
    const adj = q.body as StockAdjustment;
    expect(adj.status).toBe('pending');
    expect(detail(SERIALS[0]).status).toBe('in_stock');
    expect(make('damage', [SERIALS[0]]).status).toBe(422);

    expect(act(adj.id, 'reject', { note: 'short' }).status).toBe(422);
    expect(act(adj.id, 'approve').status).toBe(200);
    expect(act(adj.id, 'approve').status).toBe(409);
    expect(detail(SERIALS[0]).status).toBe('quarantine');
    expect(detail(SERIALS[0]).timeline.map((t) => t.type)).toContain('adjusted');

    const rel = make('release', [SERIALS[0]]).body as StockAdjustment;
    expect(act(rel.id, 'approve').status).toBe(200);
    expect(detail(SERIALS[0]).status).toBe('in_stock');

    const before = damagedTotal();
    const dmg = make('damage', [SERIALS[0]]).body as StockAdjustment;
    expect(act(dmg.id, 'approve').status).toBe(200);
    expect(detail(SERIALS[0]).status).toBe('damaged');
    expect(damagedTotal()).toBe(before + 1);
    expect(make('quarantine', [SERIALS[0]]).status).toBe(422);
  });

  it('a rejected request leaves the stock alone', () => {
    const adj = make('damage', [SERIALS[1]]).body as StockAdjustment;
    expect(act(adj.id, 'reject', { note: 'Not damaged, just dusty' }).status).toBe(200);
    expect(detail(SERIALS[1]).status).toBe('quarantine');
  });

  it('lists adjustments and gives 404 for an unknown one', () => {
    expect((A['GET /inventory/adjustments'](req('GET', '/api/v1/inventory/adjustments')).body as StockAdjustment[]).length).toBeGreaterThan(0);
    expect(A['GET /inventory/adjustments/:id'](req('GET', '/api/v1/inventory/adjustments/999')).status).toBe(404);
  });
});