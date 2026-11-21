import { describe, expect, it } from 'vitest';
import { CartLine, PosItem, Sale } from '../models/pos.models';
import { addToCart, maxDiscount, receiptHtml, refundFor, saleProblem, totals, warrantyUntil } from './pos-utils';

const item = (o: Partial<PosItem> = {}): PosItem => ({
  productId: 1, serial: 'SN1', name: 'Dell', sku: 'D1', specs: null, price: 100000, serialized: true, warrantyMonths: 12, ...o,
});

describe('pos utils', () => {
  it('adds serials once and stacks non-serial items', () => {
    let r = addToCart([], item());
    expect(r.lines.length).toBe(1);
    expect(addToCart(r.lines, item()).error).toBe('posPage.alreadyInCart');
    r = addToCart(r.lines, item({ productId: 2, serial: null, serialized: false, price: 500 }));
    r = addToCart(r.lines, item({ productId: 2, serial: null, serialized: false, price: 500 }));
    expect(r.lines[1].qty).toBe(2);
    expect(addToCart([], item({ price: null })).error).toBe('posPage.noPrice');
  });

  it('computes totals, change and limits', () => {
    const lines: CartLine[] = [{ ...item(), qty: 1 }, { ...item({ serial: 'SN2' }), qty: 1 }];
    expect(maxDiscount(200000, 5)).toBe(10000);
    expect(maxDiscount(200000, null)).toBe(200000);
    const t = totals(lines, 10000, [{ method: 'card', amount: 100000 }, { method: 'cash', amount: 95000 }]);
    expect(t).toMatchObject({ subtotal: 200000, total: 190000, paid: 195000, change: 5000, due: 0 });
    expect(saleProblem(lines, 10001, 5, [{ method: 'cash', amount: 200000 }])).toBe('posPage.discountOverLimit');
    expect(saleProblem(lines, 0, 5, [{ method: 'cash', amount: 100 }])).toBe('posPage.underpaid');
    expect(saleProblem(lines, 0, 5, [{ method: 'card', amount: 210000 }])).toBe('posPage.onlyCashChange');
    expect(saleProblem([], 0, 5, [])).toBe('posPage.emptyCart');
    expect(saleProblem(lines, 10000, 5, [{ method: 'card', amount: 100000 }, { method: 'cash', amount: 95000 }])).toBeNull();
  });

  it('builds receipt and refund amounts', () => {
    const sale: Sale = {
      id: 1, number: 'INV-1', channel: 'pos', createdAt: '2026-01-15T10:00:00Z', cashier: 'Ali', warehouseName: 'Show',
      customer: null, subtotal: 200000, discount: 10000, total: 190000, paid: 190000, change: 0, note: null,
      lines: [
        { id: 1, productId: 1, name: 'Dell <x>', sku: 'D1', serial: 'SN1', qty: 1, unitPrice: 100000, warrantyMonths: 12, returnedQty: 0 },
        { id: 2, productId: 1, name: 'Dell', sku: 'D1', serial: 'SN2', qty: 1, unitPrice: 100000, warrantyMonths: 0, returnedQty: 0 },
      ],
      payments: [{ method: 'cash', amount: 190000 }], returns: [],
    };
    const html = receiptHtml(sale, {
      shop: 'Novastackhub', tagline: 'Empowering Digital Vision', receipt: 'Receipt', cashier: 'Cashier', customer: 'Customer',
      subtotal: 'Subtotal', discount: 'Discount', total: 'Total', paid: 'Paid', change: 'Change', warranty: 'Warranty until',
      thanks: 'Thank you', methods: { cash: 'Cash' },
    });
    expect(html).toContain('INV-1');
    expect(html).toContain('Dell &lt;x&gt;');
    expect(html).toContain('2027-01-15');
    expect(refundFor(sale, [{ saleLineId: 2, qty: 1 }])).toBe(95000);
    expect(warrantyUntil('2026-01-15T10:00:00Z', 0)).toBeNull();
  });
});
