import { describe, expect, it } from 'vitest';
import { putAwayErrorKey } from './putaway-utils';

const lara = (text: string) => ({ status: 422, error: { message: 'The given data was invalid.', errors: { serials: [text] } } });

describe('putAwayErrorKey with the real server messages', () => {
  it('another warehouse', () => {
    expect(putAwayErrorKey(lara('Serial A1 is in another warehouse than this bin.'))).toBe('scanApp.putaway.errors.wrongWarehouse');
  });

  it('in transit or not in the warehouse', () => {
    expect(putAwayErrorKey(lara('Serial A1 is in transit.'))).toBe('scanApp.putaway.errors.notInStock');
    expect(putAwayErrorKey(lara('Serial A1 is not in the warehouse.'))).toBe('scanApp.putaway.errors.notInStock');
  });

  it('unknown serial and already in this bin', () => {
    expect(putAwayErrorKey(lara('Serial A1 is not known.'))).toBe('scanApp.putaway.errors.serialNotFound');
    expect(putAwayErrorKey(lara('Serial A1 is already in this bin.'))).toBe('scanApp.putaway.duplicate');
  });

  it('reads a plain message too (mock server)', () => {
    expect(putAwayErrorKey({ status: 422, error: { message: 'Serial A1 is not known.' } })).toBe('scanApp.putaway.errors.serialNotFound');
  });

  it('old codes and unknown errors still work', () => {
    expect(putAwayErrorKey({ status: 422, error: { code: 'not_in_stock' } })).toBe('scanApp.putaway.errors.notInStock');
    expect(putAwayErrorKey({ status: 404 })).toBe('scanApp.putaway.errors.serialNotFound');
    expect(putAwayErrorKey({ status: 500 })).toBe('errors.generic');
  });
});