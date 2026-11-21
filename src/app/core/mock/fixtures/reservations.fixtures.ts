import { Reservation, ReservationInput, ReservationLine } from '../../../features/inventory/models/reservation.models';
import {
  MAX_RESERVATION_SERIALS, effectiveStatus, isValidDate, todayIso,
} from '../../../features/inventory/utils/reservation-utils';
import { normalizeSerial } from '../../../features/purchase/utils/purchase-utils';
import { adjustments } from './adjustments.fixtures';
import { FixtureHandler, FixtureResponse, fail, ok } from './fixture.types';
import { holds, reservationEvents, reservedRef } from './stock-location';
import { allSerials } from './stock.fixtures';
import { transfers } from './transfers.fixtures';

export const reservations: Reservation[] = [];
let seq = 1;

const segs = (url: string): string[] => url.split('?')[0].split('/').filter(Boolean);
const lastId = (url: string): number => Number(segs(url).pop());
const idBeforeAction = (url: string): number => Number(segs(url)[segs(url).length - 2]);
const view = (r: Reservation): Reservation => ({ ...r, status: effectiveStatus(r) });

const inOpenTransfer = (serial: string): boolean =>
  transfers.some(
    (t) => (t.status === 'requested' || t.status === 'approved') && t.lines.some((l) => l.serial === serial),
  );
const hasPendingAdjustment = (serial: string): boolean =>
  adjustments.some((a) => a.status === 'pending' && a.lines.some((l) => l.serial === serial));

function create(req: { body: unknown }): FixtureResponse {
  const b = req.body as ReservationInput;
  const customer = (b?.customerName ?? '').trim();
  if (customer.length < 2) return fail(422, 'Enter the customer name.');
  if (customer.length > 100) return fail(422, 'The customer name is too long.');
  const holdUntil = (b.holdUntil ?? '').trim() || null;
  if (holdUntil !== null && (!isValidDate(holdUntil) || holdUntil < todayIso())) {
    return fail(422, 'The hold date cannot be in the past.');
  }
  const wanted = [...new Set((b.serials ?? []).map(normalizeSerial))].filter(Boolean);
  if (!wanted.length) return fail(422, 'Add at least one serial.');
  if (wanted.length > MAX_RESERVATION_SERIALS) return fail(422, `Too many serials (${MAX_RESERVATION_SERIALS} max).`);

  const stock = allSerials();
  const lines: ReservationLine[] = [];
  for (const serial of wanted) {
    const s = stock.find((x) => x.serial === serial);
    if (!s) return fail(422, `Serial ${serial} is not known.`);
    if (s.warehouseId === 0) return fail(422, `Serial ${serial} is in transit.`);
    if (s.status !== 'in_stock') return fail(422, `Serial ${serial} is not available.`);
    const held = reservedRef(serial);
    if (held) return fail(422, `Serial ${serial} is already reserved (${held}).`);
    if (inOpenTransfer(serial)) return fail(422, `Serial ${serial} is in a transfer.`);
    if (hasPendingAdjustment(serial)) return fail(422, `Serial ${serial} already has a request waiting.`);
    lines.push({ serial, name: s.name, sku: s.sku });
  }

  const at = new Date().toISOString();
  const r: Reservation = {
    id: Math.max(0, ...reservations.map((x) => x.id)) + 1,
    number: `RSV-${String(seq++).padStart(4, '0')}`,
    customerName: customer,
    note: (b.note ?? '').trim() || null,
    holdUntil,
    status: 'active',
    lines,
    createdBy: 'Mock user',
    createdAt: at,
    releasedAt: null,
  };
  reservations.push(r);
  for (const l of lines) {
    holds.set(l.serial, { ref: r.number, holdUntil });
    reservationEvents.set(l.serial, [
      ...(reservationEvents.get(l.serial) ?? []),
      { at, type: 'reserved', ref: r.number, note: `For ${customer}` },
    ]);
  }
  return ok(view(r));
}

function release(req: { url: string }): FixtureResponse {
  const r = reservations.find((x) => x.id === idBeforeAction(req.url));
  if (!r) return fail(404, 'Reservation not found.');
  const state = effectiveStatus(r);
  if (state === 'released') return fail(409, 'This reservation is already released.');
  if (state === 'expired') return fail(409, 'This reservation has already expired.');
  const at = new Date().toISOString();
  for (const l of r.lines) {
    if (holds.get(l.serial)?.ref === r.number) holds.delete(l.serial);
    reservationEvents.set(l.serial, [
      ...(reservationEvents.get(l.serial) ?? []),
      { at, type: 'released', ref: r.number, note: null },
    ]);
  }
  r.status = 'released';
  r.releasedAt = at;
  return ok(view(r));
}

export const RESERVATION_FIXTURES: Record<string, FixtureHandler> = {
  'GET /inventory/reservations': () => ok([...reservations].sort((a, b) => b.id - a.id).map(view)),
  'GET /inventory/reservations/:id': (req) => {
    const r = reservations.find((x) => x.id === lastId(req.url));
    return r ? ok(view(r)) : fail(404, 'Reservation not found.');
  },
  'POST /inventory/reservations': create,
  'POST /inventory/reservations/:id/release': release,
};