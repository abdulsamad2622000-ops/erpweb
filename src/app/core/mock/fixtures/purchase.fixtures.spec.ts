import { describe, expect, it } from 'vitest';
import { Grn, PurchaseOrder } from '../../../features/purchase/models/purchase.models';
import { LABEL_FIXTURES } from './labels.fixtures';
import { PURCHASE_FIXTURES, checkSerial } from './purchase.fixtures';

const call = (key: string, url: string, body: unknown = null) =>
  PURCHASE_FIXTURES[key]({ method: key.split(' ')[0], url, body });
const accepted = (serial: string, productId = 1) => ({ serial, productId, status: 'accepted', note: null });

describe('purchase fixtures', () => {
  it('serial check: stock duplicate, wrong model aur sahi', () => {
    expect(checkSerial('5CD2219HPQ', 2).reason).toBe('duplicate_in_stock');
    expect(checkSerial('5CD9999AAA', 1)).toMatchObject({ ok: false, reason: 'wrong_model', actualModel: 'HP ProBook 450' });
    expect(checkSerial('5CG9999AAA', 1).ok).toBe(true);
    expect(checkSerial('x', 1).reason).toBe('invalid_format');
  });

  it('PO: draft → submit → approve, phir GRN se serials receive', () => {
    const po = call('POST /purchase/orders', '/purchase/orders', {
      supplierId: 1, warehouseId: 1, orderDate: '2026-11-19', expectedDate: null, terms: '', lines: [{ productId: 1, qty: 2, unitCost: 140000 }],
    }).body as PurchaseOrder;
    expect(po.status).toBe('draft');
    expect(call('POST /purchase/grns', '/purchase/grns', { poId: po.id }).status).toBe(409);
    expect(call('POST /purchase/orders/:id/approve', `/purchase/orders/${po.id}/approve`).status).toBe(409);
    call('POST /purchase/orders/:id/submit', `/purchase/orders/${po.id}/submit`);
    const approved = call('POST /purchase/orders/:id/approve', `/purchase/orders/${po.id}/approve`, { note: 'ok' }).body as PurchaseOrder;
    expect(approved.status).toBe('approved');

    const grn = call('POST /purchase/grns', '/purchase/grns', { poId: po.id }).body as Grn;
    const lines = (serials: unknown[]) => grn.lines.map((l) => ({ ...l, serials }));
    // Reject karne par note zaroori
    expect(call('POST /purchase/grns/:id/post', `/purchase/grns/${grn.id}/post`, { lines: lines([{ ...accepted('5CG7000AAA'), status: 'rejected' }]) }).status).toBe(422);
    // Order se zyada nahi
    expect(call('POST /purchase/grns/:id/post', `/purchase/grns/${grn.id}/post`, { lines: lines([accepted('5CG7000AAA'), accepted('5CG7000AAB'), accepted('5CG7000AAC')]) }).status).toBe(422);

    const posted = call('POST /purchase/grns/:id/post', `/purchase/grns/${grn.id}/post`, {
      lines: lines([accepted('5CG7000AAA'), { ...accepted('5CG7000AAB'), status: 'rejected', note: 'Screen cracked' }]),
    }).body as Grn;
    expect(posted.status).toBe('posted');
    const after = call('GET /purchase/orders/:id', `/purchase/orders/${po.id}`).body as PurchaseOrder;
    expect(after.status).toBe('partially_received');
    expect(after.lines[0].receivedQty).toBe(1);
    // Ab yeh serial stock mein hai
    expect(checkSerial('5CG7000AAA', 1).reason).toBe('duplicate_in_stock');
    // Labels mein GRN aa gayi
    expect(LABEL_FIXTURES['GET /labels/grns']({ method: 'GET', url: '/labels/grns', body: null }).body).toContain(posted.number);
  });
});
