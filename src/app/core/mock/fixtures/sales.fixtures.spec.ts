import { describe, expect, it } from 'vitest';
import { Challan, Invoice, Quotation, SalesOrder, WholesaleCustomer } from '../../../features/sales/models/sales.models';
import { POS_FIXTURES } from './pos.fixtures';
import { products } from './products.fixtures';
import { grns } from './purchase.fixtures';
import { SALES_FIXTURES } from './sales.fixtures';
import { statusOverride } from './stock-location';

const call = (key: string, url: string, body: unknown = null) =>
  (SALES_FIXTURES[key] ?? POS_FIXTURES[key])({ method: key.split(' ')[0], url: `/api/v1${url}`, body });

describe('SALES_FIXTURES', () => {
  it('runs quotation -> order -> challan -> invoice -> payment with credit limit', () => {
    const p = products[0];
    grns.push({
      id: 9902, number: 'GRN-WS', poId: 1, poNumber: 'PO-1', supplierName: 'Seed', warehouseId: 1,
      createdAt: '2026-11-20T10:00:00.000Z', postedAt: '2026-11-20T10:00:00.000Z', status: 'posted',
      lines: [{
        productId: p.id, sku: p.sku, name: p.name, serialized: true, orderedQty: 2, previouslyReceived: 0, qty: 0,
        serials: ['WSSEED001', 'WSSEED002'].map((serial) => ({ serial, productId: p.id, status: 'accepted' as const, note: null })),
      }],
    });
    const price = p.prices!.find((x) => x.tier === 'retail')!.price;
    const cust = call('POST /customers', '/customers', {
      name: 'Ali Traders', phone: '0321-7770001', email: '', type: 'retail', priceTier: 'retail', creditLimit: price * 1.5,
      paymentTermsDays: 30, address: '', city: 'Karachi', isActive: true,
    }).body as WholesaleCustomer;
    expect(cust.balance).toBe(0);

    expect(call('POST /sales/quotations', '/sales/quotations', { customerId: cust.id, lines: [{ productId: p.id, qty: 2, unitPrice: price * 0.5 }], note: null }).status).toBe(422);
    const q = call('POST /sales/quotations', '/sales/quotations', { customerId: cust.id, lines: [{ productId: p.id, qty: 2, unitPrice: null }], note: null }).body as Quotation;
    expect(q.total).toBe(price * 2);
    const conv = call('POST /sales/quotations/:id/convert', `/sales/quotations/${q.id}/convert`).body as { order: SalesOrder };
    expect(call('POST /sales/quotations/:id/convert', `/sales/quotations/${q.id}/convert`).status).toBe(409);
    const o = conv.order;

    const ch = call('POST /sales/challans', '/sales/challans', {
      orderId: o.id, warehouseId: 1, lines: [{ orderLineId: o.lines[0].id, serials: ['wsseed001', 'WSSEED002'] }], note: null,
    }).body as Challan;
    expect(ch.lines.length).toBe(2);
    expect(statusOverride.get('WSSEED001')).toBe('sold');
    expect((call('GET /sales/orders/:id', `/sales/orders/${o.id}`).body as SalesOrder).status).toBe('delivered');

    expect(call('POST /sales/invoices', '/sales/invoices', { challanId: ch.id }).status).toBe(422); // 2x price > 1.5x limit
    const inv = call('POST /sales/invoices', '/sales/invoices', { challanId: ch.id, payments: [{ method: 'cash', amount: price }] }).body as Invoice;
    expect(inv.balance).toBe(price);
    expect(inv.status).toBe('partial');
    expect((call('GET /customers/:id', `/customers/${cust.id}`).body as WholesaleCustomer).balance).toBe(price);

    expect(call('POST /sales/invoices/:id/payments', `/sales/invoices/${inv.id}/payments`, { method: 'transfer', amount: price * 2 }).status).toBe(422);
    const after = call('POST /sales/invoices/:id/payments', `/sales/invoices/${inv.id}/payments`, { method: 'transfer', amount: price, reference: 'T1' }).body as Invoice;
    expect(after.status).toBe('paid');
    expect(after.paymentsDetail.length).toBe(2);
  });
});

describe('ledger fixtures', () => {
  it('receives FIFO, shows ledger and aging', () => {
    const cust = call('POST /customers', '/customers', {
      name: 'Ledger Co', phone: '0333-1110000', email: '', type: 'wholesale', priceTier: 'wholesale', creditLimit: 0,
      paymentTermsDays: 0, address: '', city: '', isActive: true,
    }).body as WholesaleCustomer;
    expect(call('POST /customers/:id/receipts', `/customers/${cust.id}/receipts`, { method: 'cash', amount: 10, reference: null, note: null }).status).toBe(422);
    const ag = call('GET /customers/aging', '/customers/aging').body as { rows: { customerId: number }[] };
    expect(ag.rows.some((r) => r.customerId === cust.id)).toBe(false);
    const l = call('GET /customers/:id/ledger', `/customers/${cust.id}/ledger`).body as { closing: number; entries: unknown[] };
    expect(l.closing).toBe(0);
    expect(l.entries.length).toBe(0);
  });
});
