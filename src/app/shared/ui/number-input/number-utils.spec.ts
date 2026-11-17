import { describe, expect, it } from 'vitest';
import { formatNumber, parseNumber, roundTo } from './number-utils';

describe('number-utils', () => {
  it('parseNumber: comma, Rs aur khali', () => {
    expect(parseNumber('1,250.5')).toBe(1250.5);
    expect(parseNumber('Rs 1,000')).toBe(1000);
    expect(parseNumber('.5')).toBe(0.5);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('   ')).toBeNull();
  });

  it('parseNumber: ghalat text NaN deta hai', () => {
    expect(parseNumber('abc')).toBeNaN();
    expect(parseNumber('1.2.3')).toBeNaN();
    expect(parseNumber('12a')).toBeNaN();
  });

  it('roundTo', () => {
    expect(roundTo(1.005, 2)).toBe(1.01);
    expect(roundTo(12.5, 0)).toBe(13);
  });

  it('formatNumber', () => {
    expect(formatNumber(1234567.891, 2)).toBe('1,234,567.89');
    expect(formatNumber(5, 0)).toBe('5');
    expect(formatNumber(5, 2)).toBe('5.00');
  });
});