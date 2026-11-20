import { Product } from '../../../features/products/models';
import {
  Grn, GrnLine, PoInput, PoLine, PurchaseOrder, SerialCheck, Supplier,
} from '../../../features/purchase/models/purchase.models';
import { isSerialFormatOk, normalizeSerial, remaining, statusAfterReceipt } from '../../../features/purchase/utils/purchase-utils';
import { FixtureHandler, FixtureResponse, fail, ok } from './fixture.types';
import { addLabelItems } from './labels.fixtures';
import { PRODUCT_FIXTURES, crud } from './products.fixtures';

const suppliers: Supplier[] = [
  { id: 1, name: 'Sample Traders', phone: '0300-1234567', email: 'sales@sampletraders.test', city: 'Karachi', taxNumber: '1234567-8', paymentTermsDays: 30, isActive: true },
  { id: 2, name: 'Hafeez Centre Wholesale', phone: '0321-7654321', email: 'orders@hafeez.test', city: 'Lahore', taxNumber: '', paymentTermsDays: 15, isActive: true },
];

const listProducts = (): Product[] =>
  (PRODUCT_FIXTURES['GET /products']({ method: 'GET', url: '/products?pageSize=1000', body: null }).body as { data: Product[] }).data;
const productById = (id: number): Product | undefined => listProducts().find((p) => p.id === id);

/** Mock "manufacturer" registry: serial ka prefix batata hai kis model ka hai. */
const SERIAL_PREFIX_MODEL: Record<string, number> = { '5CG': 1, '5CD': 2, MJ0: 3 };
/** Stock mein pehle se maujood serials (duplicate check). */
const inStock = new Set(['5CG3412XQQ', '5CD2219HPQ']);

let poSeq = 108;
let grnSeq = 42;
export const orders: PurchaseOrder[] = [
  {
    id: 1, number: 'PO-0108', supplierId: 1, supplierName: 'Sample Traders', warehouseId: 1, orderDate: '2026-11-15',
    expectedDate: '2026-11-20', terms: '30 days credit', status: 'approved', approvalNote: null, approvedBy: 'Demo Super Admin',
    lines: [
      { productId: 1, sku: 'LAP-DELL-001', name: 'Dell Latitude 5440', serialized: true, qty: 20, unitCost: 142000, receivedQty: 0 },
      { productId: 3, sku: 'DSK-LEN-001', name: 'Lenovo ThinkCentre M70s', serialized: true, qty: 2, unitCost: 82000, receivedQty: 0 },
    ],
  },
  {
    id: 2, number: 'PO-0107', supplierId: 2, supplierName: 'Hafeez Centre Wholesale', warehouseId: 1, orderDate: '2026-11-12',
    expectedDate: null, terms: 'Cash on delivery', status: 'pending_approval', approvalNote: null, approvedBy: null,
    lines: [{ productId: 2, sku: 'LAP-HP-001', name: 'HP ProBook 450', serialized: true, qty: 5, unitCost: 118000, receivedQty: 0 }],
  },
];
export const grns: Grn[] = [];

const segs = (url: string): string[] => url.split('?')[0].split('/').filter(Boolean);
/** /purchase/orders/5/approve -> [5, 'approve'] */
const idAndAction = (url: string): [number, string] => {
  const s = segs(url);
  return [Number(s[s.length - 2]), s[s.length - 1]];
};
const lastId = (url: string): number => Number(segs(url).pop());

function buildLines(input: PoInput, old: PoLine[] = []): PoLine[] | string {
  if (!input.lines?.length) return 'Add at least one line.';
  const out: PoLine[] = [];
  for (const l of input.lines) {
    const p = productById(l.productId);
    if (!p) return 'Unknown product.';
    if (!(l.qty > 0) || !Number.isInteger(l.qty)) return 'Quantity must be a whole number above 0.';
    if (!(l.unitCost >= 0)) return 'Unit cost cannot be negative.';
    if (out.some((x) => x.productId === p.id)) return `${p.name} is added twice.`;
    out.push({
      productId: p.id, sku: p.sku, name: p.name, serialized: !p.trackBatch, qty: l.qty, unitCost: l.unitCost,
      receivedQty: old.find((o) => o.productId === p.id)?.receivedQty ?? 0,
    });
  }
  return out;
}

function header(input: PoInput): Pick<PurchaseOrder, 'supplierId' | 'supplierName' | 'warehouseId' | 'orderDate' | 'expectedDate' | 'terms'> | string {
  const s = suppliers.find((x) => x.id === input.supplierId && x.isActive);
  if (!s) return 'Pick an active supplier.';
  if (!input.warehouseId) return 'Pick a warehouse.';
  if (!input.orderDate) return 'Order date is required.';
  if (input.expectedDate && input.expectedDate < input.orderDate) return 'Expected date cannot be before the order date.';
  return { supplierId: s.id, supplierName: s.name, warehouseId: input.warehouseId, orderDate: input.orderDate, expectedDate: input.expectedDate || null, terms: (input.terms ?? '').trim() };
}

export function checkSerial(raw: string, productId: number): SerialCheck {
  const serial = normalizeSerial(raw);
  if (!isSerialFormatOk(serial)) return { ok: false, reason: 'invalid_format', actualModel: null };
  if (inStock.has(serial) || grns.some((g) => g.status === 'posted' && g.lines.some((l) => l.serials.some((s) => s.serial === serial && s.status !== 'rejected')))) {
    return { ok: false, reason: 'duplicate_in_stock', actualModel: null };
  }
  const modelId = Object.entries(SERIAL_PREFIX_MODEL).find(([pre]) => serial.startsWith(pre))?.[1];
  if (modelId !== undefined && modelId !== productId) {
    return { ok: false, reason: 'wrong_model', actualModel: productById(modelId)?.name ?? null };
  }
  return { ok: true, reason: null, actualModel: null };
}

function validateGrnLines(grn: Grn, lines: GrnLine[], posting: boolean): string | null {
  const seen = new Set<string>();
  for (const l of lines) {
    const orig = grn.lines.find((x) => x.productId === l.productId);
    if (!orig) return 'Unknown line.';
    const left = orig.orderedQty - orig.previouslyReceived;
    const accepted = l.serialized ? l.serials.filter((s) => s.status === 'accepted').length : l.qty;
    if (accepted < 0 || accepted > left) return `${orig.name}: only ${left} left to receive.`;
    for (const s of l.serials) {
      if (seen.has(s.serial)) return `Serial ${s.serial} is entered twice.`;
      seen.add(s.serial);
      if (posting && s.status === 'accepted' && !checkSerial(s.serial, l.productId).ok) return `Serial ${s.serial} cannot be accepted.`;
      if (s.status !== 'accepted' && !s.note?.trim()) return `Serial ${s.serial}: write why it is ${s.status}.`;
    }
  }
  if (posting && lines.every((l) => (l.serialized ? l.serials.filter((s) => s.status === 'accepted').length : l.qty) === 0)) {
    return 'Nothing to post. Accept at least one item.';
  }
  return null;
}

export const PURCHASE_FIXTURES: Record<string, FixtureHandler> = {
  ...crud('purchase/suppliers', suppliers, (s) => `${s.name} ${s.phone} ${s.city}`, {
    duplicate: (b, ignoreId) => (!b.name?.trim() ? 'Name is required.' :
      suppliers.some((s) => s.id !== ignoreId && s.name.toLowerCase() === b.name.trim().toLowerCase()) ? 'This supplier already exists.' : null),
  }),

  'GET /purchase/orders': () => ok([...orders].sort((a, b) => b.id - a.id)),
  'GET /purchase/orders/:id': (req) => {
    const po = orders.find((o) => o.id === lastId(req.url));
    return po ? ok(po) : fail(404, 'Purchase order not found.');
  },
  'POST /purchase/orders': (req) => {
    const b = req.body as PoInput;
    const h = header(b);
    if (typeof h === 'string') return fail(422, h);
    const lines = buildLines(b);
    if (typeof lines === 'string') return fail(422, lines);
    const po: PurchaseOrder = { ...h, id: Math.max(0, ...orders.map((o) => o.id)) + 1, number: `PO-${String(++poSeq).padStart(4, '0')}`, status: 'draft', lines, approvalNote: null, approvedBy: null };
    orders.push(po);
    return ok(po);
  },
  'PUT /purchase/orders/:id': (req) => {
    const po = orders.find((o) => o.id === lastId(req.url));
    if (!po) return fail(404, 'Purchase order not found.');
    if (po.status !== 'draft' && po.status !== 'rejected') return fail(409, 'Only draft or rejected orders can be edited.');
    const b = req.body as PoInput;
    const h = header(b);
    if (typeof h === 'string') return fail(422, h);
    const lines = buildLines(b, po.lines);
    if (typeof lines === 'string') return fail(422, lines);
    Object.assign(po, h, { lines });
    return ok(po);
  },
  ...Object.fromEntries(['submit', 'approve', 'reject', 'cancel'].map((a) => [`POST /purchase/orders/:id/${a}`, orderAction])),
  'GET /purchase/grns': () => ok([...grns].sort((a, b) => b.id - a.id)),
  'GET /purchase/grns/:id': (req) => {
    const g = grns.find((x) => x.id === lastId(req.url));
    return g ? ok(g) : fail(404, 'GRN not found.');
  },
  'POST /purchase/grns': (req) => {
    const po = orders.find((o) => o.id === (req.body as { poId: number })?.poId);
    if (!po) return fail(404, 'Purchase order not found.');
    if (po.status !== 'approved' && po.status !== 'partially_received') return fail(409, 'Only approved orders can be received.');
    const open = grns.find((g) => g.poId === po.id && g.status === 'draft');
    if (open) return ok(open);
    const g: Grn = {
      id: Math.max(0, ...grns.map((x) => x.id)) + 1, number: `GRN-${String(++grnSeq).padStart(4, '0')}`, poId: po.id, poNumber: po.number,
      supplierName: po.supplierName, warehouseId: po.warehouseId, createdAt: new Date().toISOString(), postedAt: null, status: 'draft',
      lines: po.lines.filter((l) => remaining(l) > 0).map((l) => ({
        productId: l.productId, sku: l.sku, name: l.name, serialized: l.serialized, orderedQty: l.qty, previouslyReceived: l.receivedQty, qty: 0, serials: [],
      })),
    };
    grns.push(g);
    return ok(g);
  },
  'PUT /purchase/grns/:id': (req) => {
    const g = grns.find((x) => x.id === lastId(req.url));
    if (!g) return fail(404, 'GRN not found.');
    if (g.status !== 'draft') return fail(409, 'This GRN is already posted.');
    const lines = (req.body as { lines: GrnLine[] }).lines;
    const err = validateGrnLines(g, lines, false);
    if (err) return fail(422, err);
    g.lines = g.lines.map((o) => ({ ...o, ...lines.find((l) => l.productId === o.productId), orderedQty: o.orderedQty, previouslyReceived: o.previouslyReceived }));
    return ok(g);
  },
  'POST /purchase/grns/:id/post': (req) => {
    const [id] = idAndAction(req.url);
    return postGrn(id, req.body);
  },
  'POST /purchase/serials/check': (req) => {
    const b = req.body as { serial: string; productId: number };
    return ok(checkSerial(b?.serial ?? '', b?.productId));
  },
};

function orderAction(req: { url: string; body: unknown }): FixtureResponse {
  const [id, action] = idAndAction(req.url);
  const po = orders.find((o) => o.id === id);
  if (!po) return fail(404, 'Purchase order not found.');
  const note = ((req.body as { note?: string | null })?.note ?? '').trim() || null;
  const from: Record<string, PurchaseOrder['status'][]> = {
    submit: ['draft', 'rejected'], approve: ['pending_approval'], reject: ['pending_approval'], cancel: ['draft', 'rejected', 'approved'],
  };
  if (!from[action]) return fail(404, 'Unknown action.');
  if (!from[action].includes(po.status)) return fail(409, `This order cannot be ${action === 'submit' ? 'submitted' : action + 'd'} now.`);
  if (action === 'reject' && !note) return fail(422, 'A reason is required to reject.');
  po.status = ({ submit: 'pending_approval', approve: 'approved', reject: 'rejected', cancel: 'cancelled' } as const)[action as 'submit'];
  if (action === 'approve') po.approvedBy = 'Mock user';
  if (action === 'approve' || action === 'reject') po.approvalNote = note;
  return ok(po);
}


function postGrn(id: number, body: unknown): FixtureResponse {
  const g = grns.find((x) => x.id === id);
  if (!g) return fail(404, 'GRN not found.');
  if (g.status !== 'draft') return fail(409, 'This GRN is already posted.');
  const lines = (body as { lines: GrnLine[] }).lines;
  const err = validateGrnLines(g, lines, true);
  if (err) return fail(422, err);
  g.lines = g.lines.map((o) => ({ ...o, ...lines.find((l) => l.productId === o.productId), orderedQty: o.orderedQty, previouslyReceived: o.previouslyReceived }));
  g.status = 'posted';
  g.postedAt = new Date().toISOString();
  const po = orders.find((o) => o.id === g.poId)!;
  for (const l of g.lines) {
    const pl = po.lines.find((x) => x.productId === l.productId)!;
    pl.receivedQty += l.serialized ? l.serials.filter((s) => s.status === 'accepted').length : l.qty;
  }
  po.status = statusAfterReceipt(po.lines);
  addLabelItems(g.lines.flatMap((l) => l.serials.filter((s) => s.status === 'accepted').map((s) => {
    const p = productById(l.productId);
    const specs = p?.specs ? [p.specs.cpu, p.specs.ram, p.specs.storage].filter(Boolean).join(' / ') : null;
    return { kind: 'serial' as const, code: s.serial, name: l.name, sku: l.sku, serial: s.serial, specs, price: null, bin: null, grn: g.number, printCount: 0 };
  })));
  return ok(g);
}


