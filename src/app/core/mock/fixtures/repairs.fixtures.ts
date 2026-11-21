import { PayMethod } from '../../../features/pos/models/pos.models';
import { normalizeSerial } from '../../../features/purchase/utils/purchase-utils';
import { JobInput, JobStatus, JobUpdate, RepairJob, WarrantyCheck } from '../../../features/repairs/models/repair.models';
import { JOB_FLOW, isOpen, jobTotal, partsTotal } from '../../../features/repairs/utils/repair-utils';
import { FixtureHandler, FixtureResponse, fail, ok } from './fixture.types';
import { customers, sales } from './pos.fixtures';
import { products } from './products.fixtures';
import { statusOverride } from './stock-location';
import { allSerials } from './stock.fixtures';

export const jobs: RepairJob[] = [];
let seq = 1;

const segs = (url: string): string[] => url.split('?')[0].split('/').filter(Boolean);
const idAfter = (url: string, name: string): number => {
  const p = segs(url);
  return Number(p[p.lastIndexOf(name) + 1]);
};
const qp = (url: string, k: string): string => new URL(url, 'http://x').searchParams.get(k) ?? '';
const today = (): string => new Date().toISOString().slice(0, 10);

export function warrantyFor(raw: string): WarrantyCheck {
  const serial = normalizeSerial(raw);
  const sale = [...sales].reverse().find((s) => s.lines.some((l) => l.serial === serial && !l.returnedQty));
  const line = sale?.lines.find((l) => l.serial === serial);
  const stock = allSerials().find((s) => s.serial === serial);
  const productId = line?.productId ?? stock?.productId ?? null;
  const base: WarrantyCheck = {
    serial, productId, productName: products.find((p) => p.id === productId)?.name ?? null, sale: null, warrantyMonths: 0,
    warrantyUntil: null, warranty: 'not_ours', customer: null,
    openJob: jobs.find((j) => j.serial === serial && isOpen(j.status))?.number ?? null,
  };
  if (!sale || !line) return base;
  let until: string | null = null;
  if (line.warrantyMonths) {
    const d = new Date(sale.createdAt);
    d.setMonth(d.getMonth() + line.warrantyMonths);
    until = d.toISOString().slice(0, 10);
  }
  return {
    ...base, sale: { id: sale.id, number: sale.number, date: sale.createdAt.slice(0, 10) }, warrantyMonths: line.warrantyMonths,
    warrantyUntil: until, warranty: until && until >= today() ? 'in_warranty' : 'expired', customer: sale.customer,
  };
}

const now = (): string => new Date().toISOString();
const withTotals = (j: RepairJob): RepairJob => ({
  ...j, next: JOB_FLOW[j.status], partsTotal: partsTotal(j.parts), total: jobTotal(j.parts, j.labour),
});

function create(b: JobInput): FixtureResponse {
  if ((b?.problem ?? '').trim().length < 5) return fail(422, 'Describe the problem.');
  const w = b.serial ? warrantyFor(b.serial) : null;
  if (w?.openJob) return fail(422, `This laptop already has an open job card (${w.openJob}).`);
  const device = (b.device ?? '').trim() || w?.productName || '';
  if (!device) return fail(422, 'Write the laptop model.');
  const cust = customers.find((c) => c.id === (b.customerId ?? w?.customer?.id));
  const name = cust?.name ?? (b.customerName ?? '').trim();
  const phone = cust?.phone ?? (b.customerPhone ?? '').replace(/[^0-9+]/g, '');
  if (!name || phone.length < 7) return fail(422, 'Enter the customer name and phone.');
  const j: RepairJob = withTotals({
    id: seq, number: `JOB-${String(seq++).padStart(5, '0')}`, serial: w?.serial ?? null, productId: w?.productId ?? null, device,
    customerId: cust?.id ?? null, customerName: name, customerPhone: phone, saleNumber: w?.sale?.number ?? null,
    warranty: w?.warranty ?? 'not_ours', warrantyUntil: w?.warrantyUntil ?? null, problem: b.problem.trim(), accessories: (b.accessories ?? '').trim(),
    diagnosis: null, status: 'received', next: [], estimate: b.estimate ?? null, labour: 0, parts: [], partsTotal: 0, total: 0, paid: 0,
    paidMethod: null, promisedOn: b.promisedOn ?? null, deliveredAt: null, assignedTo: null, createdBy: 'Mock user', createdAt: now(),
    events: [{ status: 'received', note: null, at: now(), by: 'Mock user' }],
  });
  jobs.push(j);
  return { status: 201, body: j };
}

function find(url: string): RepairJob | undefined {
  return jobs.find((j) => j.id === idAfter(url, 'jobs'));
}
function save(j: RepairJob): RepairJob {
  const n = withTotals(j);
  jobs[jobs.findIndex((x) => x.id === j.id)] = n;
  return n;
}

export const REPAIR_FIXTURES: Record<string, FixtureHandler> = {
  'GET /warranty/check/:id': (req) => ok(warrantyFor(decodeURIComponent(segs(req.url).pop() ?? ''))),
  'GET /warranty/jobs': (req) => {
    const st = qp(req.url, 'status');
    const q = qp(req.url, 'search').toLowerCase();
    const rows = [...jobs].reverse().filter((j) => (!st || (st === 'open' ? isOpen(j.status) : j.status === st))
      && (!q || [j.number, j.serial ?? '', j.customerName, j.customerPhone].some((v) => v.toLowerCase().includes(q))));
    const size = Number(qp(req.url, 'pageSize')) || 20;
    const pg = Number(qp(req.url, 'page')) || 1;
    return ok({ data: rows.slice((pg - 1) * size, pg * size), total: rows.length });
  },
  'GET /warranty/jobs/:id': (req) => {
    const j = find(req.url);
    return j ? ok(j) : fail(404, 'Job card not found.');
  },
  'POST /warranty/jobs': (req) => create(req.body as JobInput),
  'PUT /warranty/jobs/:id': (req) => {
    const j = find(req.url);
    if (!j) return fail(404, 'Job card not found.');
    if (!isOpen(j.status)) return fail(409, 'This job card is closed.');
    const b = req.body as JobUpdate;
    if (b.parts) {
      const old = j.parts.map((x) => x.serial).filter(Boolean) as string[];
      const next = b.parts.map((x) => (x.serial ? normalizeSerial(x.serial) : null)).filter(Boolean) as string[];
      for (const sn of next.filter((x) => !old.includes(x))) {
        const st = allSerials().find((x) => x.serial === sn);
        if (!st || st.status !== 'in_stock') return fail(422, `Part serial ${sn} is not in stock.`);
      }
      for (const sn of old.filter((x) => !next.includes(x))) statusOverride.set(sn, 'in_stock');
      for (const sn of next) statusOverride.set(sn, 'consumed');
      b.parts = b.parts.map((x) => ({ ...x, serial: x.serial ? normalizeSerial(x.serial) : null, qty: x.serial ? 1 : x.qty }));
    }
    return ok(save({
      ...j,
      ...(b.diagnosis !== undefined ? { diagnosis: b.diagnosis } : {}),
      ...(b.labour !== undefined ? { labour: +b.labour || 0 } : {}),
      ...(b.estimate !== undefined ? { estimate: b.estimate } : {}),
      ...(b.promisedOn !== undefined ? { promisedOn: b.promisedOn } : {}),
      ...(b.parts !== undefined ? { parts: b.parts.map((p, i) => ({ ...p, id: i + 1 })) } : {}),
    }));
  },
  'POST /warranty/jobs/:id/status': (req) => {
    const j = find(req.url);
    if (!j) return fail(404, 'Job card not found.');
    const b = req.body as { status: JobStatus; note: string | null };
    if (!JOB_FLOW[j.status].includes(b?.status)) return fail(422, `Cannot move from ${j.status} to ${b?.status}.`);
    const note = (b.note ?? '').trim();
    if (b.status === 'cancelled' && note.length < 10) return fail(422, 'Write why the job is cancelled (at least 10 characters).');
    return ok(save({ ...j, status: b.status, events: [...j.events, { status: b.status, note: note || null, at: now(), by: 'Mock user' }] }));
  },
  'POST /warranty/jobs/:id/deliver': (req) => {
    const j = find(req.url);
    if (!j) return fail(404, 'Job card not found.');
    if (j.status !== 'ready') return fail(409, 'Only a ready job can be delivered.');
    const b = req.body as { amount: number; method: PayMethod | null };
    if (Math.abs((b?.amount ?? 0) - j.total) > 0.004) return fail(422, `Collect the full charges (${j.total}) before delivery.`);
    if (b.amount > 0 && !b.method) return fail(422, 'Pick how the customer paid.');
    return ok(save({ ...j, status: 'delivered', paid: b.amount, paidMethod: b.amount > 0 ? b.method : null, deliveredAt: now(),
      events: [...j.events, { status: 'delivered', note: null, at: now(), by: 'Mock user' }] }));
  },
};
