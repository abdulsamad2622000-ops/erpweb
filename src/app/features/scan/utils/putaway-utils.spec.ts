import { describe, expect, it } from 'vitest';
import { PutAwayRow } from '../models/putaway.models';
import { newIdempotencyKey } from './idempotency';
import { isBinCode, isPlacedHere, putAwayErrorKey } from './putaway-utils';

describe('putaway-utils', () => {
  it('BIN- se shuru hone wala code bin hai', () => {
    expect(isBinCode('BIN-LHR-SELL-A-R1-S1-B01')).toBe(true);
    expect(isBinCode(' bin-x ')).toBe(true);
    expect(isBinCode('SN12345')).toBe(false);
  });

  it('server ke error code se sahi key milti hai', () => {
    expect(putAwayErrorKey({ status: 422, error: { code: 'not_in_stock' } })).toBe('scanApp.putaway.errors.notInStock');
    expect(putAwayErrorKey({ status: 422, error: { code: 'wrong_warehouse' } })).toBe('scanApp.putaway.errors.wrongWarehouse');
    expect(putAwayErrorKey({ status: 404 })).toBe('scanApp.putaway.errors.serialNotFound');
    expect(putAwayErrorKey({ status: 500 })).toBe('errors.generic');
    expect(putAwayErrorKey(null)).toBe('errors.generic');
  });

  it('isPlacedHere sirf usi bin ki placed rows dekhta hai', () => {
    const rows: PutAwayRow[] = [
      { id: 1, serial: 'abc123', binBarcode: 'BIN-A', status: 'placed', message: '' },
      { id: 2, serial: 'XYZ999', binBarcode: 'BIN-A', status: 'failed', message: '' },
    ];
    expect(isPlacedHere(rows, 'ABC123', 'BIN-A')).toBe(true);
    expect(isPlacedHere(rows, 'ABC123', 'BIN-B')).toBe(false);
    expect(isPlacedHere(rows, 'XYZ999', 'BIN-A')).toBe(false);
  });

  it('idempotency key har baar alag hoti hai', () => {
    const a = newIdempotencyKey();
    const b = newIdempotencyKey();
    expect(a.length).toBeGreaterThan(8);
    expect(a).not.toBe(b);
  });
});