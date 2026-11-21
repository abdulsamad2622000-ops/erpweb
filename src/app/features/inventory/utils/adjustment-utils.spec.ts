import { describe, expect, it } from 'vitest';
import { ADJUSTMENT_TARGET, canAdjust, canDoAdjustment } from './adjustment-utils';

describe('adjustment utils', () => {
  it('allows only valid status changes', () => {
    expect(canAdjust('in_stock', 'quarantine')).toBe(true);
    expect(canAdjust('quarantine', 'quarantine')).toBe(false);
    expect(canAdjust('quarantine', 'release')).toBe(true);
    expect(canAdjust('in_stock', 'release')).toBe(false);
    expect(canAdjust('in_stock', 'damage')).toBe(true);
    expect(canAdjust('damaged', 'damage')).toBe(false);
    expect(canAdjust('returned', 'quarantine')).toBe(false);
  });

  it('knows the target status of each kind', () => {
    expect(ADJUSTMENT_TARGET.damage).toBe('damaged');
    expect(ADJUSTMENT_TARGET.release).toBe('in_stock');
  });

  it('only a pending adjustment can be decided', () => {
    expect(canDoAdjustment('pending', 'approve')).toBe(true);
    expect(canDoAdjustment('pending', 'reject')).toBe(true);
    expect(canDoAdjustment('approved', 'reject')).toBe(false);
  });
});