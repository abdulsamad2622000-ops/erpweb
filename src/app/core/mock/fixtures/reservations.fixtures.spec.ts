import { describe, expect, it } from 'vitest';
import { Reservation } from '../../../features/inventory/models/reservation.models';
import { RESERVATION_FIXTURES, reservations } from './reservations.fixtures';
import { holds, reservedRef } from './stock-location';

const call = (key: string, url: string, body: unknown = null) =>
  RESERVATION_FIXTURES[key]({ method: key.split(' ')[0], url, body });

const base = {
  note: null,
  createdBy: 'Mock user',
  createdAt: '2026-11-20T10:00:00.000Z',
  releasedAt: null,
  lines: [{ serial: 'SEED-0001', name: 'Dell Latitude', sku: 'SKU-1' }],
};

describe('reservedRef', () => {
  it('returns the reservation while it is holding and null after the hold date', () => {
    holds.set('HOLD-0001', { ref: 'RSV-1', holdUntil: null });
    holds.set('HOLD-0002', { ref: 'RSV-2', holdUntil: '2026-11-20' });
    expect(reservedRef('HOLD-0001')).toBe('RSV-1');
    expect(reservedRef('HOLD-0002', '2026-11-20')).toBe('RSV-2');
    expect(reservedRef('HOLD-0002', '2026-11-21')).toBeNull();
    expect(reservedRef('NOT-HELD')).toBeNull();
    holds.delete('HOLD-0001');
    holds.delete('HOLD-0002');
  });
});

describe('RESERVATION_FIXTURES', () => {
  it('rejects a missing customer, a past date, no serials and an unknown serial', () => {
    const post = (body: unknown) => call('POST /inventory/reservations', '/inventory/reservations', body).status;
    expect(post({ customerName: ' ', note: null, holdUntil: null, serials: ['ABCD1234'] })).toBe(422);
    expect(post({ customerName: 'Ali', note: null, holdUntil: '2000-01-01', serials: ['ABCD1234'] })).toBe(422);
    expect(post({ customerName: 'Ali', note: null, holdUntil: null, serials: [] })).toBe(422);
    const unknown = call('POST /inventory/reservations', '/inventory/reservations', {
      customerName: 'Ali', note: null, holdUntil: null, serials: ['NO-SUCH-SERIAL'],
    });
    expect(unknown.status).toBe(422);
    expect((unknown.body as { message: string }).message).toContain('not known');
  });

  it('releases an active reservation and frees its serials', () => {
    const r: Reservation = { ...base, id: 9001, number: 'RSV-9001', customerName: 'Seed', holdUntil: null, status: 'active' };
    reservations.push(r);
    holds.set('SEED-0001', { ref: 'RSV-9001', holdUntil: null });

    const res = call('POST /inventory/reservations/:id/release', '/inventory/reservations/9001/release');
    expect(res.status).toBe(200);
    expect((res.body as Reservation).status).toBe('released');
    expect(holds.has('SEED-0001')).toBe(false);

    expect(call('POST /inventory/reservations/:id/release', '/inventory/reservations/9001/release').status).toBe(409);
  });

  it('cannot release an expired reservation and lists it as expired', () => {
    reservations.push({ ...base, id: 9002, number: 'RSV-9002', customerName: 'Old', holdUntil: '2000-01-01', status: 'active' });
    expect(call('POST /inventory/reservations/:id/release', '/inventory/reservations/9002/release').status).toBe(409);
    const list = call('GET /inventory/reservations', '/inventory/reservations').body as Reservation[];
    expect(list.find((x) => x.id === 9002)?.status).toBe('expired');
  });

  it('unknown reservation gives 404', () => {
    expect(call('POST /inventory/reservations/:id/release', '/inventory/reservations/99999/release').status).toBe(404);
    expect(call('GET /inventory/reservations/:id', '/inventory/reservations/99999').status).toBe(404);
  });
});