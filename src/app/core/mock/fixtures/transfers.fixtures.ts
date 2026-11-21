import { Transfer, TransferAction, TransferInput } from '../../../features/inventory/models/transfer.models';
import { normalizeSerial } from '../../../features/purchase/utils/purchase-utils';
import { FixtureHandler, FixtureResponse, fail, ok } from './fixture.types';
import { serialWarehouse } from './stock-location';
import { allSerials } from './stock.fixtures';

export const transfers: Transfer[] = [];
let seq = 1;
const MIN_REASON = 10;

const segs = (url: string): string[] => url.split('?')[0].split('/').filter(Boolean);
const lastId = (url: string): number => Number(segs(url).pop());
const idBeforeAction = (url: string): number => Number(segs(url)[segs(url).length - 2]);
const OPEN: Transfer['status'][] = ['requested', 'approved'];

const inOpenTransfer = (serial: string): boolean =>
  transfers.some((t) => OPEN.includes(t.status) && t.lines.some((l) => l.serial === serial));

function create(req: { body: unknown }): FixtureResponse {
  const b = req.body as TransferInput;
  if (!b?.fromWarehouseId || !b.toWarehouseId) return fail(422, 'Pick both warehouses.');
  if (b.fromWarehouseId === b.toWarehouseId) return fail(422, 'The two warehouses must be different.');
  if (!b.serials?.length) return fail(422, 'Add at least one serial.');
  const stock = allSerials();
  const lines: Transfer['lines'] = [];
  for (const raw of b.serials) {
    const serial = normalizeSerial(raw);
    const s = stock.find((x) => x.serial === serial);
    if (!s) return fail(422, `Serial ${serial} is not in stock.`);
    if (s.status !== 'in_stock') return fail(422, `Serial ${serial} is not available.`);
    if (s.warehouseId !== b.fromWarehouseId) return fail(422, `Serial ${serial} is in another warehouse.`);
    if (inOpenTransfer(serial) || lines.some((l) => l.serial === serial)) return fail(422, `Serial ${serial} is already in a transfer.`);
    lines.push({ serial, name: s.name, sku: s.sku });
  }
  const t: Transfer = {
    id: Math.max(0, ...transfers.map((x) => x.id)) + 1,
    number: `TRF-${String(seq++).padStart(4, '0')}`,
    fromWarehouseId: b.fromWarehouseId,
    toWarehouseId: b.toWarehouseId,
    status: 'requested',
    lines,
    note: (b.note ?? '').trim() || null,
    reason: null,
    createdBy: 'Mock user',
    createdAt: new Date().toISOString(),
    dispatchedAt: null,
    receivedAt: null,
    receivedSerials: [],
  };
  transfers.push(t);
  return ok(t);
}

function act(req: { url: string; body: unknown }, action: TransferAction): FixtureResponse {
  const t = transfers.find((x) => x.id === idBeforeAction(req.url));
  if (!t) return fail(404, 'Transfer not found.');
  const b = (req.body ?? {}) as { note?: string | null; serials?: string[] };
  const from: Record<TransferAction, Transfer['status'][]> = {
    approve: ['requested'], reject: ['requested'], cancel: ['requested', 'approved'], dispatch: ['approved'], receive: ['in_transit'],
  };
  if (!from[action].includes(t.status)) return fail(409, `This transfer cannot be ${action}d now.`);

  if (action === 'approve') t.status = 'approved';
  if (action === 'cancel') t.status = 'cancelled';
  if (action === 'reject') {
    const reason = (b.note ?? '').trim();
    if (reason.length < MIN_REASON) return fail(422, `Write a reason of at least ${MIN_REASON} characters.`);
    t.status = 'rejected';
    t.reason = reason;
  }
  if (action === 'dispatch') {
    t.status = 'in_transit';
    t.dispatchedAt = new Date().toISOString();
    t.lines.forEach((l) => serialWarehouse.set(l.serial, 0));
  }
  if (action === 'receive') {
    const got = (b.serials ?? []).map(normalizeSerial);
    if (!got.length) return fail(422, 'Scan at least one serial.');
    for (const s of got) if (!t.lines.some((l) => l.serial === s)) return fail(422, `Serial ${s} is not in this transfer.`);
    t.receivedSerials = [...new Set(got)];
    t.receivedAt = new Date().toISOString();
    t.status = 'received';
    t.receivedSerials.forEach((s) => serialWarehouse.set(s, t.toWarehouseId));
  }
  return ok(t);
}

export const TRANSFER_FIXTURES: Record<string, FixtureHandler> = {
  'GET /inventory/transfers': () => ok([...transfers].sort((a, b) => b.id - a.id)),
  'GET /inventory/transfers/:id': (req) => {
    const t = transfers.find((x) => x.id === lastId(req.url));
    return t ? ok(t) : fail(404, 'Transfer not found.');
  },
  'POST /inventory/transfers': create,
  ...Object.fromEntries(
    (['approve', 'reject', 'dispatch', 'receive', 'cancel'] as TransferAction[]).map((a) => [
      `POST /inventory/transfers/:id/${a}`,
      (req: { url: string; body: unknown }) => act(req, a),
    ]),
  ),
};