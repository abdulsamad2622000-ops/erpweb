import { Customer, Sale } from '../../../features/pos/models/pos.models';
import { round2 } from '../../../features/pos/utils/pos-utils';
import { normalizeSerial } from '../../../features/purchase/utils/purchase-utils';
import {
  Challan, ChallanInput, CustomerForm, DocInput, Invoice, PaymentInput, Quotation, SalesOrder, WholesaleCustomer,
} from '../../../features/sales/models/sales.models';
import { FixtureHandler, FixtureResponse, fail, ok } from './fixture.types';
import { warehouses } from './org.fixtures';
import { MOCK_DISCOUNT_LIMIT, customers, sales } from './pos.fixtures';
import { products } from './products.fixtures';
import { reservedRef, statusOverride } from './stock-location';
import { allSerials } from './stock.fixtures';

interface Extra {
  paymentTermsDays: number;
  address: string;
  city: string;
}
type Inv = Sale & { challanNumber: string | null; dueDate: string | null; paymentsDetail: Invoice['paymentsDetail'] };

const extra = new Map<number, Extra>();
export const quotations: Quotation[] = [];
export const orders: SalesOrder[] = [];
export const challans: Challan[] = [];
const seq = { qt: 1, so: 1, dc: 1, inv: 9000, line: 50000 };

const segs = (url: string): string[] => url.split('?')[0].split('/').filter(Boolean);
/** URL mein resource ke baad wala id (base /api/v1 ho ya na ho). */
const idAfter = (url: string, name: string): number => {
  const p = segs(url);
  return Number(p[p.lastIndexOf(name) + 1]);
};
const qp = (url: string, k: string): string => new URL(url, 'http://x').searchParams.get(k) ?? '';
const today = (): string => new Date().toISOString().slice(0, 10);
const num = (p: string, n: number): string => `${p}${String(n).padStart(5, '0')}`;
const brief = (c: Customer) => ({ id: c.id, name: c.name, phone: c.phone, type: c.type });

const creditReturns = (s: Sale): number => round2(s.returns.filter((r) => r.refundMethod === 'credit').reduce((a, r) => a + r.amount, 0));
const saleBalance = (s: Sale): number => round2(Math.max(s.total - s.paid + s.change - creditReturns(s), 0));
export const balanceOf = (customerId: number): number =>
  round2(sales.filter((s) => s.customer?.id === customerId).reduce((a, s) => a + s.total - s.paid + s.change - creditReturns(s), 0));

const custOut = (c: Customer): WholesaleCustomer => ({
  ...c, ...(extra.get(c.id) ?? { paymentTermsDays: 0, address: '', city: '' }), balance: balanceOf(c.id),
});

function tierPrice(productId: number, tier: string): number | null {
  const p = products.find((x) => x.id === productId);
  const pick = (t: string) => p?.prices?.find((x) => x.tier === t)?.price;
  return pick(tier) ?? pick('retail') ?? null;
}
const lowest = (price: number): number => round2(price * (1 - MOCK_DISCOUNT_LIMIT / 100));

function priceLines(b: DocInput): { lines: Quotation['lines']; total: number } | FixtureResponse {
  const c = customers.find((x) => x.id === b?.customerId);
  if (!c) return fail(422, 'Pick a customer.');
  if (!b.lines?.length) return fail(422, 'Add at least one item.');
  const lines: Quotation['lines'] = [];
  for (const l of b.lines) {
    const p = products.find((x) => x.id === l.productId);
    const tp = tierPrice(l.productId, c.priceTier);
    if (!p || tp === null) return fail(422, 'This item has no price for this customer.');
    const price = l.unitPrice ?? tp;
    if (price + 0.001 < lowest(tp)) return fail(422, `${p.name}: lowest price you can give is ${lowest(tp)}.`);
    if (!(l.qty >= 1)) return fail(422, 'Enter a quantity.');
    lines.push({ id: seq.line++, productId: p.id, name: p.name, sku: p.sku, serialized: !p.trackBatch, qty: l.qty, unitPrice: price, amount: round2(l.qty * price) });
  }
  return { lines, total: round2(lines.reduce((a, l) => a + l.amount, 0)) };
}
const isFail = (x: unknown): x is FixtureResponse => !!x && typeof x === 'object' && 'status' in x;

const qView = (q: Quotation): Quotation =>
  ['draft', 'sent'].includes(q.status) && q.validUntil && q.validUntil < today() ? { ...q, status: 'expired' } : q;

function invView(s: Inv): Invoice {
  const balance = saleBalance(s);
  const status = balance <= 0.004 ? 'paid' : s.paid > 0 ? 'partial' : s.dueDate && s.dueDate < today() ? 'overdue' : 'unpaid';
  return { ...s, balance, returned: round2(s.returns.reduce((a, r) => a + r.amount, 0)), status,
    challanNumber: s.challanNumber ?? null, dueDate: s.dueDate ?? null,
    paymentsDetail: s.paymentsDetail ?? s.payments.map((p) => ({ ...p, reference: null, paidAt: s.createdAt })) };
}

function page<T>(rows: T[], url: string): FixtureResponse {
  const size = Number(qp(url, 'pageSize')) || 20;
  const pg = Number(qp(url, 'page')) || 1;
  return ok({ data: rows.slice((pg - 1) * size, pg * size), total: rows.length });
}
const match = (url: string, ...vals: string[]): boolean => {
  const q = qp(url, 'search').toLowerCase();
  return !q || vals.some((v) => v.toLowerCase().includes(q));
};

function saveCustomer(b: CustomerForm, id?: number): FixtureResponse {
  const name = (b?.name ?? '').trim();
  const phone = (b?.phone ?? '').replace(/[^0-9+]/g, '');
  if (name.length < 2) return fail(422, 'Enter the customer name.');
  if (phone.length < 7) return fail(422, 'Enter a phone number.');
  if (customers.some((c) => c.phone === phone && c.id !== id)) return fail(422, 'A customer with this phone already exists.');
  const type = b.type ?? 'retail';
  const row: Customer = {
    id: id ?? Math.max(0, ...customers.map((c) => c.id)) + 1, name, phone, email: (b.email ?? '').trim(), type,
    priceTier: b.priceTier || type, creditLimit: +b.creditLimit || 0, isActive: b.isActive ?? true,
  };
  if (id) {
    const i = customers.findIndex((c) => c.id === id);
    if (i < 0) return fail(404, 'Customer not found.');
    customers[i] = row;
  } else customers.push(row);
  extra.set(row.id, { paymentTermsDays: +b.paymentTermsDays || 0, address: (b.address ?? '').trim(), city: (b.city ?? '').trim() });
  return { status: id ? 200 : 201, body: custOut(row) };
}

function createChallan(b: ChallanInput): FixtureResponse {
  const o = orders.find((x) => x.id === b?.orderId);
  if (!o) return fail(404, 'Sales order not found.');
  if (!['open', 'partial'].includes(o.status)) return fail(409, 'This order is closed.');
  if (!warehouses.some((w) => w.id === b.warehouseId)) return fail(422, 'Pick a warehouse.');
  const rows: Challan['lines'] = [];
  const seen = new Set<string>();
  for (const l of b.lines ?? []) {
    const ol = o.lines.find((x) => x.id === l.orderLineId);
    if (!ol) return fail(422, 'This item is not on the order.');
    const left = ol.qty - ol.deliveredQty;
    if (ol.serialized) {
      const sns = [...new Set((l.serials ?? []).map(normalizeSerial).filter(Boolean))];
      if (sns.length > left) return fail(422, `${ol.name}: only ${left} left to deliver.`);
      for (const sn of sns) {
        if (seen.has(sn)) return fail(422, `Serial ${sn} is added twice.`);
        seen.add(sn);
        const s = allSerials().find((x) => x.serial === sn);
        const why = !s ? 'is not in stock' : s.productId !== ol.productId ? 'belongs to another product' : s.status !== 'in_stock'
          ? `is ${s.status}` : s.warehouseId !== b.warehouseId ? 'is in another warehouse' : reservedRef(sn) ? `is reserved (${reservedRef(sn)})` : null;
        if (why) return fail(422, `Serial ${sn} ${why}.`);
        rows.push({ id: seq.line++, orderLineId: ol.id, productId: ol.productId, name: ol.name, sku: ol.sku, serial: sn, qty: 1 });
      }
    } else if ((l.qty ?? 0) > 0) {
      if ((l.qty ?? 0) > left) return fail(422, `${ol.name}: only ${left} left to deliver.`);
      rows.push({ id: seq.line++, orderLineId: ol.id, productId: ol.productId, name: ol.name, sku: ol.sku, serial: null, qty: l.qty! });
    }
  }
  if (!rows.length) return fail(422, 'Scan at least one serial or enter a quantity.');
  for (const r of rows) {
    o.lines.find((x) => x.id === r.orderLineId)!.deliveredQty += r.qty;
    if (r.serial) statusOverride.set(r.serial, 'sold');
  }
  o.status = o.lines.every((l) => l.deliveredQty >= l.qty) ? 'delivered' : 'partial';
  const c: Challan = {
    id: challans.length + 1, number: num('DC-', seq.dc++), orderId: o.id, orderNumber: o.number, customer: o.customer,
    warehouseId: b.warehouseId, warehouseName: warehouses.find((w) => w.id === b.warehouseId)?.name ?? '', invoiceId: null,
    invoiceNumber: null, note: b.note ?? null, createdBy: 'Mock user', createdAt: new Date().toISOString(), lines: rows,
  };
  challans.push(c);
  o.challans.push({ id: c.id, number: c.number, invoiced: false, createdAt: c.createdAt });
  return { status: 201, body: c };
}

function createInvoice(b: { challanId: number; payments?: PaymentInput[] }): FixtureResponse {
  const c = challans.find((x) => x.id === b?.challanId);
  if (!c) return fail(404, 'Challan not found.');
  if (c.invoiceId) return fail(409, 'This challan is already invoiced.');
  const o = orders.find((x) => x.id === c.orderId)!;
  const cust = customers.find((x) => x.id === o.customer.id)!;
  const lines = c.lines.map((l) => ({ ...l, unitPrice: o.lines.find((x) => x.id === l.orderLineId)!.unitPrice }));
  const total = round2(lines.reduce((a, l) => a + l.qty * l.unitPrice, 0));
  const pays = b.payments ?? [];
  const paid = round2(pays.reduce((a, p) => a + p.amount, 0));
  if (paid > total + 0.001) return fail(422, 'Payment is more than the invoice.');
  const credit = round2(total - paid);
  if (credit > 0.004) {
    if (cust.creditLimit <= 0) return fail(422, 'This customer has no credit. Take full payment.');
    const due = balanceOf(cust.id);
    if (due + credit > cust.creditLimit + 0.001) {
      return fail(422, `Credit limit exceeded. Limit ${cust.creditLimit}, already due ${due}, this bill adds ${credit}.`);
    }
  }
  const now = new Date();
  const dueDate = new Date(now.getTime() + (extra.get(cust.id)?.paymentTermsDays ?? 0) * 86400000).toISOString().slice(0, 10);
  const inv: Inv = {
    id: seq.inv++, number: num('INV-W', seq.inv - 9000), channel: 'wholesale', createdAt: now.toISOString(), cashier: 'Mock user',
    warehouseName: c.warehouseName, customer: brief(cust), subtotal: total, discount: 0, total, paid, change: 0, note: o.number,
    lines: lines.map((l) => ({
      id: seq.line++, productId: l.productId, name: l.name, sku: l.sku, serial: l.serial, qty: l.qty, unitPrice: l.unitPrice,
      warrantyMonths: products.find((p) => p.id === l.productId)?.warrantyMonths ?? 0, returnedQty: 0,
    })),
    payments: pays.map((p) => ({ method: p.method, amount: p.amount })), returns: [],
    challanNumber: c.number, dueDate,
    paymentsDetail: pays.map((p) => ({ method: p.method, amount: p.amount, reference: p.reference ?? null, paidAt: now.toISOString() })),
  };
  sales.push(inv);
  c.invoiceId = inv.id;
  c.invoiceNumber = inv.number;
  const oc = o.challans.find((x) => x.id === c.id);
  if (oc) oc.invoiced = true;
  return { status: 201, body: invView(inv) };
}

export const SALES_FIXTURES: Record<string, FixtureHandler> = {
  'GET /customers': (req) => {
    const all = qp(req.url, 'all') === 'true';
    const type = qp(req.url, 'type');
    return ok(customers.filter((c) => (all || c.isActive) && (!type || c.type === type) && match(req.url, c.name, c.phone)).map(custOut));
  },
  'POST /customers': (req) => saveCustomer(req.body as CustomerForm),
  'GET /customers/:id': (req) => {
    const c = customers.find((x) => x.id === idAfter(req.url, 'customers'));
    return c ? ok(custOut(c)) : fail(404, 'Customer not found.');
  },
  'PUT /customers/:id': (req) => saveCustomer(req.body as CustomerForm, idAfter(req.url, 'customers')),

  'GET /sales/price': (req) => {
    const c = customers.find((x) => x.id === Number(qp(req.url, 'customerId')));
    const p = products.find((x) => x.id === Number(qp(req.url, 'productId')));
    if (!c || !p) return fail(422, 'Pick a customer and an item.');
    const tp = tierPrice(p.id, c.priceTier);
    return ok({ id: p.id, name: p.name, sku: p.sku, serialized: !p.trackBatch, tierPrice: tp, lowestPrice: tp === null ? null : lowest(tp), tier: c.priceTier });
  },

  'GET /sales/quotations': (req) =>
    page(
      [...quotations].reverse().map(qView)
        .filter((q) => (!qp(req.url, 'status') || q.status === qp(req.url, 'status')) && match(req.url, q.number, q.customer.name)),
      req.url,
    ),
  'GET /sales/quotations/:id': (req) => {
    const q = quotations.find((x) => x.id === idAfter(req.url, 'quotations'));
    return q ? ok(qView(q)) : fail(404, 'Quotation not found.');
  },
  'POST /sales/quotations': (req) => {
    const b = req.body as DocInput;
    const r = priceLines(b);
    if (isFail(r)) return r;
    if (b.validUntil && b.validUntil < today()) return fail(422, 'Valid until cannot be in the past.');
    const c = customers.find((x) => x.id === b.customerId)!;
    const q: Quotation = {
      id: quotations.length + 1, number: num('QT-', seq.qt++), customer: brief(c), status: 'draft', validUntil: b.validUntil ?? null,
      total: r.total, note: b.note ?? null, createdBy: 'Mock user', createdAt: new Date().toISOString(), orderId: null, lines: r.lines,
    };
    quotations.push(q);
    return { status: 201, body: q };
  },
  'PUT /sales/quotations/:id': (req) => {
    const q = quotations.find((x) => x.id === idAfter(req.url, 'quotations'));
    if (!q) return fail(404, 'Quotation not found.');
    if (q.status !== 'draft') return fail(409, 'Only a draft quotation can be changed.');
    const b = req.body as DocInput;
    const r = priceLines(b);
    if (isFail(r)) return r;
    Object.assign(q, { customer: brief(customers.find((x) => x.id === b.customerId)!), lines: r.lines, total: r.total,
      note: b.note ?? null, validUntil: b.validUntil ?? null });
    return ok(q);
  },
  'POST /sales/quotations/:id/send': (req) => {
    const q = quotations.find((x) => x.id === idAfter(req.url, 'quotations'));
    if (!q) return fail(404, 'Quotation not found.');
    if (q.status !== 'draft') return fail(409, 'Only a draft can be sent.');
    q.status = 'sent';
    return ok(qView(q));
  },
  'POST /sales/quotations/:id/cancel': (req) => {
    const q = quotations.find((x) => x.id === idAfter(req.url, 'quotations'));
    if (!q) return fail(404, 'Quotation not found.');
    if (!['draft', 'sent'].includes(q.status)) return fail(409, 'This quotation cannot be cancelled.');
    q.status = 'cancelled';
    return ok(q);
  },
  'POST /sales/quotations/:id/convert': (req) => {
    const q = quotations.find((x) => x.id === idAfter(req.url, 'quotations'));
    if (!q) return fail(404, 'Quotation not found.');
    if (!['draft', 'sent'].includes(q.status)) return fail(409, 'This quotation was already used or cancelled.');
    if (qView(q).status === 'expired') return fail(409, 'This quotation has expired. Make a new one.');
    q.status = 'accepted';
    const o: SalesOrder = {
      id: orders.length + 1, number: num('SO-', seq.so++), customer: q.customer, status: 'open', quotationNumber: q.number, total: q.total,
      note: q.note, createdBy: 'Mock user', createdAt: new Date().toISOString(),
      lines: q.lines.map((l) => ({ ...l, id: seq.line++, deliveredQty: 0 })), challans: [],
    };
    orders.push(o);
    q.orderId = o.id;
    return ok({ quotation: q, order: o });
  },

  'GET /sales/orders': (req) => {
    const st = qp(req.url, 'status').split(',').filter(Boolean);
    return page([...orders].reverse().filter((o) => (!st.length || st.includes(o.status)) && match(req.url, o.number, o.customer.name)), req.url);
  },
  'GET /sales/orders/:id': (req) => {
    const o = orders.find((x) => x.id === idAfter(req.url, 'orders'));
    return o ? ok(o) : fail(404, 'Sales order not found.');
  },
  'POST /sales/orders': (req) => {
    const b = req.body as DocInput;
    const r = priceLines(b);
    if (isFail(r)) return r;
    const o: SalesOrder = {
      id: orders.length + 1, number: num('SO-', seq.so++), customer: brief(customers.find((x) => x.id === b.customerId)!), status: 'open',
      quotationNumber: null, total: r.total, note: b.note ?? null, createdBy: 'Mock user', createdAt: new Date().toISOString(),
      lines: r.lines.map((l) => ({ ...l, deliveredQty: 0 })), challans: [],
    };
    orders.push(o);
    return { status: 201, body: o };
  },
  'POST /sales/orders/:id/cancel': (req) => {
    const o = orders.find((x) => x.id === idAfter(req.url, 'orders'));
    if (!o) return fail(404, 'Sales order not found.');
    if (o.status !== 'open') return fail(409, 'Only an order with nothing delivered can be cancelled.');
    o.status = 'cancelled';
    return ok(o);
  },

  'GET /sales/challans': (req) => {
    const inv = qp(req.url, 'invoiced');
    return page([...challans].reverse().filter((c) => (!inv || (inv === 'true') === !!c.invoiceId)
      && match(req.url, c.number, c.orderNumber, c.customer.name)), req.url);
  },
  'GET /sales/challans/:id': (req) => {
    const c = challans.find((x) => x.id === idAfter(req.url, 'challans'));
    return c ? ok(c) : fail(404, 'Challan not found.');
  },
  'POST /sales/challans': (req) => createChallan(req.body as ChallanInput),

  'GET /sales/invoices': (req) => {
    const ch = qp(req.url, 'channel');
    const cid = Number(qp(req.url, 'customerId'));
    const unpaid = qp(req.url, 'unpaid') === 'true';
    return page([...sales].reverse().map((s) => invView(s as Inv))
      .filter((s) => (!ch || s.channel === ch) && (!cid || s.customer?.id === cid) && (!unpaid || s.balance > 0.004)
        && match(req.url, s.number, s.customer?.name ?? '')), req.url);
  },
  'GET /sales/invoices/:id': (req) => {
    const s = sales.find((x) => x.id === idAfter(req.url, 'invoices'));
    return s ? ok(invView(s as Inv)) : fail(404, 'Invoice not found.');
  },
  'POST /sales/invoices': (req) => createInvoice(req.body as { challanId: number; payments?: PaymentInput[] }),
  'POST /sales/invoices/:id/payments': (req) => {
    const s = sales.find((x) => x.id === idAfter(req.url, 'invoices')) as Inv | undefined;
    if (!s) return fail(404, 'Invoice not found.');
    const b = req.body as PaymentInput;
    const bal = saleBalance(s);
    if (!(b?.amount > 0)) return fail(422, 'Enter the amount.');
    if (b.amount > bal + 0.001) return fail(422, `Only ${bal} is due on this invoice.`);
    s.paid = round2(s.paid + b.amount);
    s.payments.push({ method: b.method, amount: b.amount });
    s.paymentsDetail = [...(s.paymentsDetail ?? []), { method: b.method, amount: b.amount, reference: b.reference ?? null, paidAt: new Date().toISOString() }];
    return ok(invView(s));
  },
};
