import {
  AdjustmentAction, AdjustmentInput, AdjustmentLine, StockAdjustment,
} from '../../../features/inventory/models/adjustment.models';
import { ADJUSTMENT_KINDS, ADJUSTMENT_TARGET, MIN_REASON, canAdjust } from '../../../features/inventory/utils/adjustment-utils';
import { normalizeSerial } from '../../../features/purchase/utils/purchase-utils';
import { FixtureHandler, FixtureResponse, fail, ok } from './fixture.types';
import { adjustmentEvents, reservedRef, statusOverride } from './stock-location';
import { allSerials } from './stock.fixtures';

export const adjustments: StockAdjustment[] = [];
let seq = 1;

const segs = (url: string): string[] => url.split('?')[0].split('/').filter(Boolean);
const lastId = (url: string): number => Number(segs(url).pop());
const idBeforeAction = (url: string): number => Number(segs(url)[segs(url).length - 2]);

function create(req: { body: unknown }): FixtureResponse {
  const b = req.body as AdjustmentInput;
  if (!b || !ADJUSTMENT_KINDS.includes(b.kind)) return fail(422, 'Pick what to do with the stock.');
  const reason = (b.reason ?? '').trim();
  if (reason.length < MIN_REASON) return fail(422, `Write a reason of at least ${MIN_REASON} characters.`);
  const wanted = [...new Set((b.serials ?? []).map(normalizeSerial))];
  if (!wanted.length) return fail(422, 'Add at least one serial.');

  const stock = allSerials();
  const waiting = new Set(adjustments.filter((a) => a.status === 'pending').flatMap((a) => a.lines.map((l) => l.serial)));
  const lines: AdjustmentLine[] = [];
  for (const serial of wanted) {
    const s = stock.find((x) => x.serial === serial);
    if (!s) return fail(422, `Serial ${serial} is not known.`);
    if (s.warehouseId === 0) return fail(422, `Serial ${serial} is in transit.`);
    if (waiting.has(serial)) return fail(422, `Serial ${serial} already has a request waiting.`);
    const held = reservedRef(serial);
    if (held) return fail(422, `Serial ${serial} is reserved (${held}). Release the reservation first.`);
    if (!canAdjust(s.status, b.kind)) return fail(422, `Serial ${serial} cannot be changed from ${s.status}.`);
    lines.push({ serial, name: s.name, sku: s.sku, from: s.status, to: ADJUSTMENT_TARGET[b.kind] });
  }
  const a: StockAdjustment = {
    id: Math.max(0, ...adjustments.map((x) => x.id)) + 1,
    number: `ADJ-${String(seq++).padStart(4, '0')}`,
    kind: b.kind,
    status: 'pending',
    lines,
    reason,
    decisionNote: null,
    createdBy: 'Mock user',
    createdAt: new Date().toISOString(),
    decidedAt: null,
  };
  adjustments.push(a);
  return ok(a);
}

function act(req: { url: string; body: unknown }, action: AdjustmentAction): FixtureResponse {
  const a = adjustments.find((x) => x.id === idBeforeAction(req.url));
  if (!a) return fail(404, 'Adjustment not found.');
  if (a.status !== 'pending') return fail(409, `This adjustment cannot be ${action}d now.`);
  const note = (((req.body ?? {}) as { note?: string | null }).note ?? '').trim();

  if (action === 'reject') {
    if (note.length < MIN_REASON) return fail(422, `Write a reason of at least ${MIN_REASON} characters.`);
    a.status = 'rejected';
    a.decisionNote = note;
    a.decidedAt = new Date().toISOString();
    return ok(a);
  }

  const stock = allSerials();
  for (const l of a.lines) {
    const now = stock.find((s) => s.serial === l.serial);
    if (!now || now.status !== l.from) return fail(409, `Serial ${l.serial} has changed since this request was made.`);
  }
  const at = new Date().toISOString();
  for (const l of a.lines) {
    statusOverride.set(l.serial, l.to);
    adjustmentEvents.set(l.serial, [...(adjustmentEvents.get(l.serial) ?? []), { at, type: 'adjusted', ref: a.number, note: a.reason }]);
  }
  a.status = 'approved';
  a.decisionNote = note || null;
  a.decidedAt = at;
  return ok(a);
}

export const ADJUSTMENT_FIXTURES: Record<string, FixtureHandler> = {
  'GET /inventory/adjustments': () => ok([...adjustments].sort((x, y) => y.id - x.id)),
  'GET /inventory/adjustments/:id': (req) => {
    const a = adjustments.find((x) => x.id === lastId(req.url));
    return a ? ok(a) : fail(404, 'Adjustment not found.');
  },
  'POST /inventory/adjustments': create,
  ...Object.fromEntries(
    (['approve', 'reject'] as AdjustmentAction[]).map((a) => [
      `POST /inventory/adjustments/:id/${a}`,
      (req: { url: string; body: unknown }) => act(req, a),
    ]),
  ),
};