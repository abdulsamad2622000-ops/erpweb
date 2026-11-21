import { describe, expect, it } from 'vitest';
import { creditCheck, docPrintHtml, docTotal, leftToDeliver, lineProblem } from './sales-utils';

describe('sales utils', () => {
  it('totals and line checks', () => {
    expect(docTotal([{ qty: 2, unitPrice: 90000 }, { qty: 1, unitPrice: 500.5 }])).toBe(180500.5);
    const l = { productId: 1, name: 'Dell', sku: 'D', qty: 1, unitPrice: 89000, tierPrice: 90000, lowestPrice: 89100 };
    expect(lineProblem(l)).toBe('salesDocs.errors.belowLowest');
    expect(lineProblem({ ...l, unitPrice: 89100 })).toBeNull();
    expect(lineProblem({ ...l, qty: 0 })).toBe('salesDocs.errors.qty');
    expect(lineProblem({ ...l, unitPrice: 0, lowestPrice: 0 })).toBe('salesDocs.errors.price');
  });

  it('delivery left and credit check', () => {
    expect(leftToDeliver({ id: 1, productId: 1, name: '', sku: '', serialized: true, qty: 3, unitPrice: 1, amount: 3, deliveredQty: 2 })).toBe(1);
    expect(creditCheck(90000, 90000, 0, 0)).toEqual({ credit: 0, allowed: true });
    expect(creditCheck(90000, 0, 0, 0)).toEqual({ credit: 90000, allowed: false });
    expect(creditCheck(90000, 10000, 180000, 200000)).toEqual({ credit: 80000, allowed: false });
    expect(creditCheck(90000, 10000, 100000, 200000)).toEqual({ credit: 80000, allowed: true });
  });

  it('prints escaped document', () => {
    const html = docPrintHtml({
      title: 'Quotation', number: 'QT-1', date: '2026-11-21', party: 'Ali <Traders>', total: 100,
      rows: [{ name: 'Dell', detail: 'S/N X', qty: 1, price: 100 }], footer: 'Thanks',
      labels: { item: 'Item', qty: 'Qty', price: 'Price', amount: 'Amount', total: 'Total' },
    });
    expect(html).toContain('Ali &lt;Traders&gt;');
    expect(html).toContain('QT-1');
  });
});
