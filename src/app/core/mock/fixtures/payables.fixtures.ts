import {
  BillInput, LandedCost, LandedCostItem, LedgerEntry, PaymentInput, PaymentMethod, PoMatching,
  PurchaseReturn, PurchaseReturnInput, ReturnableSerial, SupplierBill, SupplierPayment,
} from '../../../features/purchase/models/payables.models';
import { Grn, PurchaseOrder } from '../../../features/purchase/models/purchase.models';
import { outstanding, paymentAmountError, round2 } from '../../../features/purchase/utils/payables-utils';
import { normalizeSerial } from '../../../features/purchase/utils/purchase-utils';
import { FixtureHandler, fail, ok } from './fixture.types';
import { grns, orders } from './purchase.fixtures';

const METHODS: PaymentMethod[] = ['cash', 'bank_transfer', 'cheque'];
const MIN_REASON = 10;

/** Purana hisaab jo system se pehle ka tha (mock). */
const openingBalance: Record<number, number> = { 1: 250000, 2: 90000 };

const payments: SupplierPayment[] = [];
export const returns: PurchaseReturn[] = [];
const landed = new Map<number, LandedCostItem[]>();
const bills = new Map<number, SupplierBill>();
let payId = 1;
let retId = 1;

const segs = (url: string): string[] => url.split('?')[0].split('/').filter(Boolean);
const idFromEnd = (url: string, n: number): number => Number(segs(url)[segs(url).length - n]);
const query = (url: string): URLSearchParams => new URLSearchParams(url.split('?')[1] ?? '');
const pad = (n: number): string => String(n).padStart(4, '0');

function grnValue(g: Grn): number {
  const po = orders.find((o) => o.id === g.poId);
  return round2(
    g.lines.reduce((sum, l) => {
      const cost = po?.lines.find((x) => x.productId === l.productId)?.unitCost ?? 0;
      const qty = l.serialized ? l.serials.filter((s) => s.status === 'accepted').length : l.qty;
      return sum + qty * cost;
    }, 0),
  );
}

function ledgerFor(supplierId: number): LedgerEntry[] {
  const out: LedgerEntry[] = [];
  if (openingBalance[supplierId]) {
    out.push({ id: 'open', date: '2026-10-01', type: 'opening', ref: 'Opening balance', increase: openingBalance[supplierId], decrease: 0 });
  }
  for (const g of grns) {
    if (g.status !== 'posted') continue;
    if (orders.find((o) => o.id === g.poId)?.supplierId !== supplierId) continue;
    out.push({ id: `grn-${g.id}`, date: (g.postedAt ?? '').slice(0, 10), type: 'grn', ref: g.number, increase: grnValue(g), decrease: 0 });
  }
  for (const r of returns.filter((x) => x.supplierId === supplierId)) {
    out.push({ id: `ret-${r.id}`, date: r.date, type: 'return', ref: r.number, increase: 0, decrease: r.total });
  }
  for (const p of payments.filter((x) => x.supplierId === supplierId)) {
    out.push({ id: `pay-${p.id}`, date: p.date, type: 'payment', ref: p.reference || `Payment ${p.id}`, increase: 0, decrease: p.amount });
  }
  return out;
}

interface Received {
  grn: Grn;
  po: PurchaseOrder;
  productId: number;
  name: string;
  sku: string;
  unitCost: number;
}

function findReceived(serial: string): Received | null {
  for (const g of grns) {
    if (g.status !== 'posted') continue;
    for (const l of g.lines) {
      if (!l.serials.some((s) => s.serial === serial && s.status === 'accepted')) continue;
      const po = orders.find((o) => o.id === g.poId);
      if (!po) continue;
      const unitCost = po.lines.find((x) => x.productId === l.productId)?.unitCost ?? 0;
      return { grn: g, po, productId: l.productId, name: l.name, sku: l.sku, unitCost };
    }
  }
  return null;
}

const isReturned = (serial: string): boolean => returns.some((r) => r.lines.some((l) => l.serial === serial));

function matchingFor(po: PurchaseOrder): PoMatching {
  return {
    poId: po.id,
    poNumber: po.number,
    lines: po.lines.map((l) => ({ productId: l.productId, name: l.name, orderedQty: l.qty, receivedQty: l.receivedQty, unitCost: l.unitCost })),
    grnNumbers: grns.filter((g) => g.poId === po.id && g.status === 'posted').map((g) => g.number),
    bill: bills.get(po.id) ?? null,
  };
}

export const PAYABLES_FIXTURES: Record<string, FixtureHandler> = {
  'GET /purchase/suppliers/:id/ledger': (req) => {
    const supplierId = idFromEnd(req.url, 2);
    return ok({ supplierId, entries: ledgerFor(supplierId) });
  },

  'GET /purchase/payments': (req) => {
    const sid = query(req.url).get('supplierId');
    return ok(payments.filter((p) => !sid || p.supplierId === Number(sid)).sort((a, b) => b.id - a.id));
  },
  'POST /purchase/payments': (req) => {
    const b = req.body as PaymentInput;
    if (!b?.supplierId) return fail(422, 'Pick a supplier.');
    if (!b.date) return fail(422, 'Payment date is required.');
    if (!METHODS.includes(b.method)) return fail(422, 'Choose a payment method.');
    const err = paymentAmountError(Number(b.amount), outstanding(ledgerFor(b.supplierId)));
    if (err === 'invalid') return fail(422, 'Enter an amount above 0.');
    if (err === 'too_much') return fail(422, 'This is more than the amount owed to the supplier.');
    const p: SupplierPayment = {
      id: payId++, supplierId: b.supplierId, date: b.date, amount: round2(Number(b.amount)), method: b.method,
      reference: (b.reference ?? '').trim(), note: (b.note ?? '').trim() || null, createdBy: 'Mock user',
    };
    payments.push(p);
    return ok(p);
  },

  'GET /purchase/grns/:id/landed-cost': (req) => {
    const id = idFromEnd(req.url, 2);
    if (!grns.some((g) => g.id === id)) return fail(404, 'GRN not found.');
    const res: LandedCost = { grnId: id, items: landed.get(id) ?? [] };
    return ok(res);
  },
  'PUT /purchase/grns/:id/landed-cost': (req) => {
    const id = idFromEnd(req.url, 2);
    const g = grns.find((x) => x.id === id);
    if (!g) return fail(404, 'GRN not found.');
    if (g.status !== 'posted') return fail(409, 'Add landed cost after the GRN is posted.');
    const items = (req.body as { items: LandedCostItem[] })?.items ?? [];
    if (items.length > 20) return fail(422, 'Too many cost lines (20 max).');
    for (const i of items) {
      if (!i.label?.trim()) return fail(422, 'Every cost line needs a name.');
      if (!(i.amount > 0) || i.amount > 10_000_000) return fail(422, `${i.label}: enter an amount above 0.`);
    }
    landed.set(id, items.map((i) => ({ label: i.label.trim(), amount: round2(i.amount) })));
    return ok({ grnId: id, items: landed.get(id) });
  },

  'GET /purchase/orders/:id/matching': (req) => {
    const po = orders.find((o) => o.id === idFromEnd(req.url, 2));
    return po ? ok(matchingFor(po)) : fail(404, 'Purchase order not found.');
  },
  'POST /purchase/orders/:id/bill': (req) => {
    const po = orders.find((o) => o.id === idFromEnd(req.url, 2));
    if (!po) return fail(404, 'Purchase order not found.');
    if (po.lines.every((l) => l.receivedQty === 0)) return fail(409, 'Nothing is received on this order yet.');
    const b = req.body as BillInput;
    if (!b?.number?.trim()) return fail(422, 'Supplier invoice number is required.');
    if (!b.billDate) return fail(422, 'Invoice date is required.');
    if (!(b.amount > 0)) return fail(422, 'Enter an amount above 0.');
    const bill: SupplierBill = { poId: po.id, number: b.number.trim(), billDate: b.billDate, amount: round2(b.amount) };
    bills.set(po.id, bill);
    return ok(bill);
  },

  'GET /purchase/returns': () => ok([...returns].sort((a, b) => b.id - a.id)),
  'GET /purchase/returns/serial/:id': (req) => {
    const serial = normalizeSerial(decodeURIComponent(segs(req.url).pop() ?? ''));
    const r = findReceived(serial);
    if (!r) return fail(404, 'This serial was not received through a posted GRN.');
    if (isReturned(serial)) return fail(409, 'This serial is already returned to the supplier.');
    const res: ReturnableSerial = {
      serial, productId: r.productId, name: r.name, sku: r.sku, supplierId: r.po.supplierId,
      supplierName: r.po.supplierName, grnNumber: r.grn.number, unitCost: r.unitCost,
    };
    return ok(res);
  },
  'POST /purchase/returns': (req) => {
    const b = req.body as PurchaseReturnInput;
    if (!b?.supplierId) return fail(422, 'Pick a supplier.');
    const reason = (b.reason ?? '').trim();
    if (reason.length < MIN_REASON) return fail(422, `Write a reason of at least ${MIN_REASON} characters.`);
    if (!b.serials?.length) return fail(422, 'Add at least one serial.');
    const lines: PurchaseReturn['lines'] = [];
    for (const raw of b.serials) {
      const serial = normalizeSerial(raw);
      const r = findReceived(serial);
      if (!r) return fail(422, `Serial ${serial} was not received through a posted GRN.`);
      if (r.po.supplierId !== b.supplierId) return fail(422, `Serial ${serial} belongs to ${r.po.supplierName}.`);
      if (isReturned(serial) || lines.some((l) => l.serial === serial)) return fail(422, `Serial ${serial} is already returned.`);
      lines.push({ serial, name: r.name, unitCost: r.unitCost });
    }
    const first = findReceived(lines[0].serial)!;
    const ret: PurchaseReturn = {
      id: retId, number: `RET-${pad(retId++)}`, supplierId: b.supplierId, supplierName: first.po.supplierName,
      date: new Date().toISOString().slice(0, 10), lines, total: round2(lines.reduce((s, l) => s + l.unitCost, 0)),
      reason, createdBy: 'Mock user',
    };
    returns.push(ret);
    return ok(ret);
  },
};