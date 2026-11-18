import { describe, expect, it } from 'vitest';
import { KeyBurstTracker, cleanScan } from './scan-utils';

describe('cleanScan', () => {
  it('spaces trim karta hai', () => {
    expect(cleanScan('  ABC123  ')).toBe('ABC123');
  });

  it('control characters hata deta hai', () => {
    expect(cleanScan('AB\r\n\tC1\u0007')).toBe('ABC1');
  });

  it('khali text par khali deta hai', () => {
    expect(cleanScan('   ')).toBe('');
  });
});

describe('KeyBurstTracker', () => {
  function feed(times: number[]): KeyBurstTracker {
    const t = new KeyBurstTracker();
    for (const x of times) t.push(x);
    return t;
  }

  it('tez keys ko burst maanta hai', () => {
    expect(feed([0, 10, 20, 30, 40]).isBurst()).toBe(true);
  });

  it('dheere type karne ko burst nahi maanta', () => {
    expect(feed([0, 200, 400, 600, 800]).isBurst()).toBe(false);
  });

  it('ek bhi bada gap ho to burst nahi', () => {
    expect(feed([0, 10, 20, 500, 510]).isBurst()).toBe(false);
  });

  it('kam keys par burst nahi', () => {
    expect(feed([0, 10, 20]).isBurst()).toBe(false);
  });

  it('minLength aur maxGap badal sakte hain', () => {
    const t = feed([0, 80, 160]);
    expect(t.isBurst(3, 100)).toBe(true);
    expect(t.isBurst(3, 50)).toBe(false);
  });

  it('reset par count zero ho jata hai', () => {
    const t = feed([0, 10, 20, 30]);
    t.reset();
    expect(t.count).toBe(0);
    expect(t.isBurst()).toBe(false);
  });
});