import { describe, expect, it } from 'vitest';
import { effectiveStatus, isHolding, isValidDate, todayIso } from './reservation-utils';

describe('reservation utils', () => {
  it('todayIso gives the date part', () => {
    expect(todayIso(new Date('2026-11-21T10:00:00Z'))).toBe('2026-11-21');
  });

  it('an active reservation with no end date stays active', () => {
    expect(effectiveStatus({ status: 'active', holdUntil: null }, '2030-01-01')).toBe('active');
  });

  it('holds on the hold date and expires the day after', () => {
    const r = { status: 'active' as const, holdUntil: '2026-11-20' };
    expect(effectiveStatus(r, '2026-11-20')).toBe('active');
    expect(effectiveStatus(r, '2026-11-21')).toBe('expired');
  });

  it('a released reservation stays released', () => {
    expect(effectiveStatus({ status: 'released', holdUntil: '2000-01-01' }, '2026-11-21')).toBe('released');
  });

  it('isHolding is true only for active', () => {
    expect(isHolding({ status: 'active', holdUntil: null }, '2026-11-21')).toBe(true);
    expect(isHolding({ status: 'active', holdUntil: '2026-01-01' }, '2026-11-21')).toBe(false);
    expect(isHolding({ status: 'released', holdUntil: null }, '2026-11-21')).toBe(false);
  });

  it('isValidDate accepts YYYY-MM-DD only', () => {
    expect(isValidDate('2026-11-21')).toBe(true);
    expect(isValidDate('21-11-2026')).toBe(false);
    expect(isValidDate('')).toBe(false);
  });
});