import { describe, expect, it } from 'vitest';
import { unwrapEnvelope } from './envelope.interceptor';

describe('unwrapEnvelope', () => {
  it('single object ka data khol deta hai', () => {
    expect(unwrapEnvelope({ data: { id: 1 } })).toEqual({ id: 1 });
  });
  it('total ke baghair list ko total deta hai', () => {
    expect(unwrapEnvelope({ data: [{ id: 1 }, { id: 2 }] })).toEqual({ data: [{ id: 1 }, { id: 2 }], total: 2 });
  });
  it('paged list aur doosri shakal ko nahi chhedta', () => {
    const paged = { data: [], total: 0, meta: {} };
    expect(unwrapEnvelope(paged)).toBe(paged);
    expect(unwrapEnvelope({ twoFactorRequired: false })).toEqual({ twoFactorRequired: false });
    expect(unwrapEnvelope(null)).toBeNull();
    expect(unwrapEnvelope([1])).toEqual([1]);
  });
});
