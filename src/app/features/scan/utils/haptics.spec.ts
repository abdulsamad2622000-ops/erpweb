import { afterEach, describe, expect, it, vi } from 'vitest';
import { VIBRATE_ERROR, VIBRATE_OK, vibrate } from './haptics';

describe('vibrate', () => {
  afterEach(() => {
    Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true });
  });

  it('support ho to navigator.vibrate chalata hai', () => {
    const fn = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: fn, configurable: true });
    vibrate(VIBRATE_OK);
    vibrate(VIBRATE_ERROR);
    expect(fn).toHaveBeenNthCalledWith(1, 60);
    expect(fn).toHaveBeenNthCalledWith(2, [120, 60, 120]);
  });

  it('support na ho to error nahi aata', () => {
    Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true });
    expect(() => vibrate(VIBRATE_OK)).not.toThrow();
  });
});