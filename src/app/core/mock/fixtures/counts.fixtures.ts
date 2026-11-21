import { CountAction, CountInput, CountLine, StockCount } from '../../../features/inventory/models/count.models';
import { normalizeSerial } from '../../../features/purchase/utils/purchase-utils';
import { FixtureHandler, FixtureResponse, fail, ok } from './fixture.types';
import { allSerials } from './stock.fixtures';

export const counts: StockCount[] = [];
let seq = 1;
const MIN_REASON = 10;
const ACTIVE: StockCount['status'][] = ['open', 'submitted'];

const segs = (url: string): string[] => url.split('?')[0].split('/').filter(Boolean);
const lastId = (url: string): number => Number(segs(url).pop());
const idBeforeAction = (url: string): number => Number(segs(url)[segs(url).length - 2]);

function create(req: { body: unknown }): FixtureResponse {
  const b = req.body as CountInput;
  if (!b?.warehouseId) return fail(422, 'Pick a warehouse.');
  if (counts.some((c) => c.warehouseId === b.warehouseId && ACTIVE.includes(c.status))) {
    return fail(422, 'This warehouse already has a count in progress.');
  }
  const expected: CountLine[] = allSerials()
    .filter((s) => s.warehouseId === b.warehouseId && s.status === 'in_stock')
    .map((s) => ({ serial: s.serial, name: s.name, sku: s.sku }));
  if (!expected.length) return fail(422, 'This warehouse has no stock to count.');
  const c: StockCount = {
    id: Math.max(0, ...counts.map((x) => x.id)) + 1,
    number: `CNT-${String(seq++).padStart(4, '0')}`,
    warehouseId: b.warehouseId,
    status: 'open',
    expected,
    counted: [],
    note: (b.note ?? '').trim() || null,
    reason: null,
    createdBy: 'Mock user',
    createdAt: new Date().toISOString(),
    submittedAt: null,
    decidedAt: null,
  };
  counts.push(c);
  return ok(c);
}

function act(req: { url: string; body: unknown }, action: CountAction): FixtureResponse {
  const c = counts.find((x) => x.id === idBeforeAction(req.url));
  if (!c) return fail(404, 'Count not found.');
  const b = (req.body ?? {}) as { note?: string | null; serials?: string[] };
  const from: Record<CountAction, StockCount['status'][]> = {
    submit: ['open'], approve: ['submitted'], reject: ['submitted'],
  };
  if (!from[action].includes(c.status)) return fail(409, `This count cannot be ${action}ed now.`);

  if (action === 'submit') {
    const wanted = [...new Set((b.serials ?? []).map(normalizeSerial))];
    if (!wanted.length) return fail(422, 'Scan at least one serial.');
    const stock = allSerials();
    const counted: CountLine[] = [];
    for (const serial of wanted) {
      const s = stock.find((x) => x.serial === serial);
      if (!s) return fail(422, `Serial ${serial} is not known.`);
      counted.push({ serial, name: s.name, sku: s.sku });
    }
    c.counted = counted;
    c.status = 'submitted';
    c.submittedAt = new Date().toISOString();
  }
  if (action === 'approve') {
    c.status = 'approved';
    c.decidedAt = new Date().toISOString();
  }
  if (action === 'reject') {
    const reason = (b.note ?? '').trim();
    if (reason.length < MIN_REASON) return fail(422, `Write a reason of at least ${MIN_REASON} characters.`);
    c.status = 'rejected';
    c.reason = reason;
    c.decidedAt = new Date().toISOString();
  }
  return ok(c);
}

export const COUNT_FIXTURES: Record<string, FixtureHandler> = {
  'GET /inventory/counts': () => ok([...counts].sort((a, b) => b.id - a.id)),
  'GET /inventory/counts/:id': (req) => {
    const c = counts.find((x) => x.id === lastId(req.url));
    return c ? ok(c) : fail(404, 'Count not found.');
  },
  'POST /inventory/counts': create,
  ...Object.fromEntries(
    (['submit', 'approve', 'reject'] as CountAction[]).map((a) => [
      `POST /inventory/counts/:id/${a}`,
      (req: { url: string; body: unknown }) => act(req, a),
    ]),
  ),
};