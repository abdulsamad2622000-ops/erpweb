import { describe, expect, it } from 'vitest';
import { PosItem, Sale } from '../../../features/pos/models/pos.models';
import { POS_FIXTURES } from './pos.fixtures';
import { grns } from './purchase.fixtures';
import { statusOverride } from './stock-location';
import { allSerials } from './stock.fixtures';

const call = (key: string, url: string, body: unknown = null) => POS_FIXTURES[key]({ method: key.split(' ')[0], url, body });

describe('POS_FIXTURES', () => {
  it('runs shift -> sale -> return -> close', () => {
    grns.push({
      id: 9901, number: 'GRN-POS', poId: 1, poNumber: 'PO-1', supplierName: 'Seed', warehouseId: 1,
      createdAt: '2026-11-20T10:00:00.000Z', postedAt: '2026-11-20T10:00:00.000Z', status: 'posted',
      lines: [{
        productId: 1, sku: 'LAP-DELL-001', name: 'Dell Latitude 5440', serialized: true, orderedQty: 1, previouslyReceived: 0,
        qty: 0, serials: [{ serial: 'POSSEED001', productId: 1, status: 'accepted', note: null }],
      }],
    });
    const s = allSerials().find((x) => x.serial === 'POSSEED001');
    expect(s).toBeTruthy();
    const serial = s!.serial;
    expect(call('GET /pos/scan/:id', `/pos/scan/${serial}`).status).toBe(409);
    expect(call('POST /pos/shift/open', '/pos/shift/open', { warehouseId: s!.warehouseId, openingCash: 1000 }).status).toBe(201);

    const item = call('GET /pos/scan/:id', `/pos/scan/${serial}`).body as PosItem;
    expect(item.serial).toBe(serial);
    const price = item.price!;
    const over = call('POST /pos/sales', '/pos/sales', {
      customerId: null, lines: [{ productId: item.productId, serial, qty: 1 }], discount: price * 0.06,
      payments: [{ method: 'cash', amount: price }], note: null,
    });
    expect(over.status).toBe(422);
    const res = call('POST /pos/sales', '/pos/sales', {
      customerId: null, lines: [{ productId: item.productId, serial, qty: 1 }], discount: 0,
      payments: [{ method: 'cash', amount: price + 500 }], note: null,
    });
    expect(res.status).toBe(201);
    const sale = res.body as Sale;
    expect(sale.change).toBe(500);
    expect(statusOverride.get(serial)).toBe('sold');
    expect(call('GET /pos/scan/:id', `/pos/scan/${serial}`).status).toBe(422);

    const found = call('GET /pos/sales/find/:id', `/pos/sales/find/${serial}`).body as Sale;
    expect(found.number).toBe(sale.number);
    const ret = call('POST /pos/returns', '/pos/returns', {
      saleId: sale.id, lines: [{ saleLineId: sale.lines[0].id, qty: 1 }], refundMethod: 'cash', reason: 'Customer changed mind',
    });
    expect(ret.status).toBe(201);
    expect(statusOverride.get(serial)).toBe('in_stock');

    const st = call('GET /pos/shift', '/pos/shift').body as { shift: { expectedCash: number } };
    expect(st.shift.expectedCash).toBe(1000);
    expect(call('POST /pos/shift/close', '/pos/shift/close', { countedCash: 900, note: '' }).status).toBe(422);
    expect(call('POST /pos/shift/close', '/pos/shift/close', { countedCash: 1000, note: null }).status).toBe(200);
  });

  it('adds customers once per phone', () => {
    expect(call('POST /customers', '/customers', { name: 'Sara', phone: '0321-5550000' }).status).toBe(201);
    expect(call('POST /customers', '/customers', { name: 'Sara 2', phone: '03215550000' }).status).toBe(422);
  });
});
