import { describe, expect, it } from 'vitest';
import { canDo, missingSerials } from './transfer-utils';

describe('transfer utils', () => {
  it('allows only the right actions per status', () => {
    expect(canDo('requested', 'approve')).toBe(true);
    expect(canDo('requested', 'dispatch')).toBe(false);
    expect(canDo('approved', 'dispatch')).toBe(true);
    expect(canDo('in_transit', 'receive')).toBe(true);
    expect(canDo('received', 'cancel')).toBe(false);
  });

  it('finds serials that did not arrive', () => {
    const lines = [
      { serial: 'A1', name: 'x', sku: 's' },
      { serial: 'A2', name: 'x', sku: 's' },
    ];
    expect(missingSerials({ lines, receivedSerials: ['A1'], status: 'received' })).toEqual(['A2']);
    expect(missingSerials({ lines, receivedSerials: [], status: 'in_transit' })).toEqual([]);
  });
});