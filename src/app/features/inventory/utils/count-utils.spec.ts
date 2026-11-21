import { describe, expect, it } from 'vitest';
import { canDoCount, variance } from './count-utils';

const line = (serial: string) => ({ serial, name: 'x', sku: 's' });

describe('count utils', () => {
  it('allows only the right actions per status', () => {
    expect(canDoCount('open', 'submit')).toBe(true);
    expect(canDoCount('open', 'approve')).toBe(false);
    expect(canDoCount('submitted', 'approve')).toBe(true);
    expect(canDoCount('submitted', 'reject')).toBe(true);
    expect(canDoCount('approved', 'reject')).toBe(false);
  });

  it('finds missing, extra and matched serials', () => {
    const v = variance({ expected: [line('A1'), line('A2'), line('A3')], counted: [line('A1'), line('A3'), line('Z9')] });
    expect(v.missing.map((l) => l.serial)).toEqual(['A2']);
    expect(v.extra.map((l) => l.serial)).toEqual(['Z9']);
    expect(v.matched).toBe(2);
  });

  it('has no variance when everything matches', () => {
    const v = variance({ expected: [line('A1')], counted: [line('A1')] });
    expect(v.missing.length + v.extra.length).toBe(0);
  });
});