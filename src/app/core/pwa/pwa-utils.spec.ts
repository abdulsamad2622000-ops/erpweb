import { describe, expect, it } from 'vitest';
import { isIos, isStandalone } from './pwa-utils';

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15';
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';

describe('pwa utils', () => {
  it('detects iPhone, iPad pretending to be a Mac, and not Android or a real Mac', () => {
    expect(isIos(IPHONE)).toBe(true);
    expect(isIos(MAC, 5)).toBe(true);
    expect(isIos(MAC, 0)).toBe(false);
    expect(isIos(ANDROID, 5)).toBe(false);
  });

  it('knows when the app runs from the home screen', () => {
    expect(isStandalone({ standalone: true })).toBe(true);
    expect(isStandalone({}, () => ({ matches: true }))).toBe(true);
    expect(isStandalone({}, () => ({ matches: false }))).toBe(false);
    expect(isStandalone({})).toBe(false);
  });
});