import {
  CartLine, Customer, CustomerInput, HeldBill, PosItem, PosShift, ReturnInput, Sale, SaleInput,
} from '../../../features/pos/models/pos.models';
import { maxDiscount, refundFor, round2 } from '../../../features/pos/utils/pos-utils';
import { normalizeSerial } from '../../../features/purchase/utils/purchase-utils';
import { FixtureHandler, FixtureResponse, fail, ok } from './fixture.types';
import { warehouses } from './org.fixtures';
import { products } from './products.fixtures';
import { reservedRef, statusOverride, serialWarehouse } from './stock-location';
import { allSerials } from './stock.fixtures';

/** Mock: discount limit 5% (design jaisa). */
export const MOCK_DISCOUNT_LIMIT = 5;

interface ShiftRow extends PosShift {
  cash: number;
}

let shift: ShiftRow | null = null;
export const sales: Sale[] = [];
const held: HeldBill[] = [];
export const customers: Customer[] = [
  { id: 1, name: 'Bilal Ahmed', phone: '03001234567', email: '', type: 'retail', priceTier: 'retail', creditLimit: 0, isActive: true },
];
let invSeq = 1;
let retSeq = 1;

const segs = (url: string): string[] => url.split('?')[0].split('/').filter(Boolean);
const last = (url: string): string => decodeURIComponent(segs(url).pop() ?? '');
const query = (url: string, k: string): string => new URL(url, 'http://x').searchParams.get(k) ?? '';

const view = (s: ShiftRow): PosShift => {
  const mine = sales.filter((x) => x.id > 0 && (x as Sale & { shiftId?: number }).shiftId === s.id);
  const { cash, ...rest } = s;
  return {
    ...rest,
    salesCount: mine.length,
    salesTotal: round2(mine.reduce((a, x) => a + x.total, 0)),
    expectedCash: round2(s.openingCash + cash),
  };
};

function itemOf(productId: number, serial: string | null): PosItem | null {
  const p = products.find((x) => x.id === productId);
  if (!p) return null;
  return {
    productId, serial, name: p.name, sku: p.sku,
    specs: [p.specs?.cpu, p.specs?.ram, p.specs?.storage].filter(Boolean).join(' / ') || null,
    price: p.prices?.find((t) => t.tier === 'retail')?.price ?? null,
    serialized: !p.trackBatch, warrantyMonths: p.warrantyMonths ?? 0,
  };
}

function serialProblem(serial: string): string | null {
  const s = allSerials().find((x) => x.serial === serial);
  if (!s) return 'This serial is not in stock.';
  if (s.status !== 'in_stock') return `This serial is ${s.status}, not available for sale.`;
  if (shift && s.warehouseId !== shift.warehouseId) return 'This serial is in another warehouse.';
  const r = reservedRef(serial);
  if (r) return `This serial is reserved (${r}).`;
  return null;
}

function scan(req: { url: string }): FixtureResponse {
  if (!shift) return fail(409, 'Open a shift before selling.');
  const code = normalizeSerial(last(req.url));
  const s = allSerials().find((x) => x.serial === code);
  if (s) {
    const why = serialProblem(code);
    return why ? fail(422, why) : ok(itemOf(s.productId, code));
  }
  const p = products.find((x) => x.sku.toUpperCase() === code || x.barcode === code);
  if (!p) return fail(404, 'No serial, SKU or barcode matches this code.');
  if (!p.trackBatch) return fail(422, 'This laptop is tracked by serial. Scan the serial number.');
  return ok(itemOf(p.id, null));
}

function search(req: { url: string }): FixtureResponse {
  if (!shift) return fail(409, 'Open a shift before selling.');
  const q = query(req.url, 'search').trim().toLowerCase();
  if (q.length < 2) return ok([]);
  const free = allSerials().filter((s) => !serialProblem(s.serial));
  return ok(
    products
      .filter((p) => p.isActive && (p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)))
      .slice(0, 20)
      .map((p) => {
        const serials = free.filter((s) => s.productId === p.id).map((s) => s.serial);
        return { ...itemOf(p.id, null), inStock: serials.length, serials: serials.slice(0, 20) };
      }),
  );
}

function complete(req: { body: unknown }): FixtureResponse {
  if (!shift) return fail(409, 'Open a shift before selling.');
  const b = req.body as SaleInput;
  if (!b?.lines?.length) return fail(422, 'Add at least one item.');
  const lines: Sale['lines'] = [];
  const seen = new Set<string>();
  for (const l of b.lines) {
    const it = itemOf(l.productId, null);
    if (!it || it.price === null) return fail(422, 'This item has no retail price.');
    let serial: string | null = null;
    if (it.serialized) {
      serial = normalizeSerial(l.serial ?? '');
      if (!serial) return fail(422, `Scan the serial for ${it.name}.`);
      if (seen.has(serial)) return fail(422, `Serial ${serial} is added twice.`);
      seen.add(serial);
      const why = serialProblem(serial);
      if (why) return fail(422, `${serial}: ${why}`);
    }
    lines.push({
      id: sales.reduce((a, s) => a + s.lines.length, 0) + lines.length + 1, productId: l.productId, name: it.name, sku: it.sku,
      serial, qty: serial ? 1 : Math.max(1, l.qty || 1), unitPrice: it.price, warrantyMonths: it.warrantyMonths, returnedQty: 0,
    });
  }
  const subtotal = round2(lines.reduce((a, l) => a + l.qty * l.unitPrice, 0));
  const discount = round2(b.discount || 0);
  if (discount > subtotal) return fail(422, 'Discount cannot be more than the bill.');
  if (discount > maxDiscount(subtotal, MOCK_DISCOUNT_LIMIT) + 0.001) {
    return fail(422, `Your discount limit is ${MOCK_DISCOUNT_LIMIT}% of the bill.`);
  }
  const total = round2(subtotal - discount);
  const paid = round2((b.payments ?? []).reduce((a, p) => a + p.amount, 0));
  const cash = round2((b.payments ?? []).filter((p) => p.method === 'cash').reduce((a, p) => a + p.amount, 0));
  if (paid + 0.001 < total) return fail(422, 'Payment is less than the total.');
  const change = round2(paid - total);
  if (change > cash + 0.001) return fail(422, 'Only cash can be overpaid (for change).');

  const customer = customers.find((c) => c.id === b.customerId) ?? null;
  const sale: Sale & { shiftId: number } = {
    id: sales.length + 1, number: `INV-${String(invSeq++).padStart(5, '0')}`, channel: 'pos', createdAt: new Date().toISOString(),
    cashier: 'Mock user', warehouseName: shift.warehouseName,
    customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone } : null,
    subtotal, discount, total, paid, change, note: b.note ?? null, lines, payments: b.payments, returns: [], shiftId: shift.id,
  };
  sales.push(sale);
  shift.cash = round2(shift.cash + cash - change);
  for (const l of lines) if (l.serial) statusOverride.set(l.serial, 'sold');
  return { status: 201, body: sale };
}

function findSale(req: { url: string }): FixtureResponse {
  const code = normalizeSerial(last(req.url));
  const s = sales.find((x) => x.number === code) ?? [...sales].reverse().find((x) => x.lines.some((l) => l.serial === code));
  return s ? ok(s) : fail(404, 'No sale found for this receipt or serial.');
}

function doReturn(req: { body: unknown }): FixtureResponse {
  const b = req.body as ReturnInput;
  const sale = sales.find((s) => s.id === b?.saleId);
  if (!sale) return fail(404, 'Sale not found.');
  if ((b.reason ?? '').trim().length < 10) return fail(422, 'Write a reason of at least 10 characters.');
  if (!b.lines?.length) return fail(422, 'Pick the items being returned.');
  if (b.refundMethod === 'cash' && !shift) return fail(409, 'Open a shift to refund cash.');
  if (b.refundMethod === 'credit' && !sale.customer) return fail(422, 'Credit refund needs a customer on the sale.');
  const picks = b.lines.map((p) => {
    const l = sale.lines.find((x) => x.id === p.saleLineId);
    return { l, qty: l?.serial ? 1 : Math.max(1, p.qty || 1) };
  });
  for (const p of picks) {
    if (!p.l) return fail(422, 'This item is not on the sale.');
    if (p.qty > p.l.qty - p.l.returnedQty) return fail(422, 'This item was already returned.');
  }
  const amount = refundFor(sale, picks.map((p) => ({ saleLineId: p.l!.id, qty: p.qty })));
  for (const p of picks) {
    p.l!.returnedQty += p.qty;
    if (p.l!.serial) {
      statusOverride.set(p.l!.serial, 'in_stock');
      if (shift) serialWarehouse.set(p.l!.serial, shift.warehouseId);
    }
  }
  const number = `SR-${String(retSeq++).padStart(5, '0')}`;
  sale.returns.push({ number, amount, refundMethod: b.refundMethod, createdAt: new Date().toISOString() });
  if (b.refundMethod === 'cash' && shift) {
    shift.cash = round2(shift.cash - amount);
    shift.cashRefunds = round2(shift.cashRefunds + amount);
  }
  return { status: 201, body: { id: retSeq, number, amount, refundMethod: b.refundMethod, sale } };
}

export const POS_FIXTURES: Record<string, FixtureHandler> = {
  'GET /pos/shift': () => ok({ shift: shift ? view(shift) : null, discountLimit: MOCK_DISCOUNT_LIMIT }),
  'POST /pos/shift/open': (req) => {
    if (shift) return fail(409, 'You already have an open shift.');
    const b = req.body as { warehouseId: number; openingCash: number };
    const wh = warehouses.find((w) => w.id === b?.warehouseId);
    if (!wh) return fail(422, 'Pick the counter warehouse.');
    if (!(b.openingCash >= 0)) return fail(422, 'Enter the opening cash.');
    shift = {
      id: Date.now() % 100000, warehouseId: wh.id, warehouseName: wh.name, openingCash: round2(b.openingCash),
      openedAt: new Date().toISOString(), closedAt: null, salesCount: 0, salesTotal: 0, cashIn: 0, cashRefunds: 0,
      expectedCash: round2(b.openingCash), countedCash: null, note: null, cash: 0,
    };
    return { status: 201, body: view(shift) };
  },
  'POST /pos/shift/close': (req) => {
    if (!shift) return fail(409, 'Open a shift before selling.');
    const b = req.body as { countedCash: number; note: string | null };
    const v = view(shift);
    const note = (b?.note ?? '').trim();
    if (Math.abs((b?.countedCash ?? 0) - v.expectedCash) >= 0.01 && note.length < 10) {
      return fail(422, 'Cash does not match. Explain the difference (at least 10 characters).');
    }
    const out = { ...v, closedAt: new Date().toISOString(), countedCash: round2(b.countedCash), note: note || null };
    shift = null;
    return ok(out);
  },
  'GET /pos/scan/:id': scan,
  'GET /pos/search': search,
  'POST /pos/sales': complete,
  'GET /pos/sales': () => ok([...sales].reverse().map((s) => ({ id: s.id, number: s.number, total: s.total, createdAt: s.createdAt }))),
  'GET /pos/sales/:id': (req) => {
    const s = sales.find((x) => x.id === Number(last(req.url)));
    return s ? ok(s) : fail(404, 'Sale not found.');
  },
  'GET /pos/sales/find/:id': findSale,
  'GET /pos/holds': () => ok([...held].reverse()),
  'POST /pos/holds': (req) => {
    const b = req.body as { label: string; payload: { lines: CartLine[]; customer: Customer | null; discount: number } };
    if (held.length >= 20) return fail(422, 'You already have 20 held bills. Recall or delete one first.');
    const id = Math.max(0, ...held.map((h) => h.id)) + 1;
    held.push({ id, label: b.label, payload: b.payload, createdAt: new Date().toISOString() });
    return { status: 201, body: { id } };
  },
  'DELETE /pos/holds/:id': (req) => {
    const i = held.findIndex((h) => h.id === Number(last(req.url)));
    if (i < 0) return fail(404, 'Held bill not found.');
    held.splice(i, 1);
    return { status: 204, body: null };
  },
  'POST /pos/returns': doReturn,
  'GET /customers': (req) => {
    const q = query(req.url, 'search').trim().toLowerCase();
    return ok(customers.filter((c) => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q)));
  },
  'POST /customers': (req) => {
    const b = req.body as CustomerInput;
    const name = (b?.name ?? '').trim();
    const phone = (b?.phone ?? '').replace(/[^0-9+]/g, '');
    if (name.length < 2) return fail(422, 'Enter the customer name.');
    if (phone.length < 7) return fail(422, 'Enter a phone number.');
    if (customers.some((c) => c.phone === phone)) return fail(422, 'A customer with this phone already exists.');
    const c: Customer = {
      id: Math.max(0, ...customers.map((x) => x.id)) + 1, name, phone, email: (b.email ?? '').trim(), type: 'retail',
      priceTier: 'retail', creditLimit: 0, isActive: true,
    };
    customers.push(c);
    return { status: 201, body: c };
  },
};
