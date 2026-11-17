import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { compareMoney, formatMoney, moneyValidator, normalizeMoney, toCents } from './money';

describe('money utils', () => {
  it('normalizes valid amounts to two decimals', () => {
    expect(normalizeMoney('1250.5')).toBe('1250.50');
    expect(normalizeMoney('1,250')).toBe('1250.00');
    expect(normalizeMoney('12.')).toBe('12.00');
    expect(normalizeMoney('007')).toBe('7.00');
    expect(normalizeMoney('0.5')).toBe('0.50');
    expect(normalizeMoney('00.5')).toBe('0.50');
  });

  it('rejects invalid amounts', () => {
    expect(normalizeMoney('')).toBeNull();
    expect(normalizeMoney('abc')).toBeNull();
    expect(normalizeMoney('1.234')).toBeNull();
    expect(normalizeMoney('-5')).toBeNull();
    expect(normalizeMoney('.5')).toBeNull();
  });

  it('converts to cents without float errors', () => {
    expect(toCents('0.10')).toBe(10n);
    expect(toCents('0.30')).toBe(30n);
    expect(toCents('1250.50')).toBe(125050n);
    expect(() => toCents('abc')).toThrow();
  });

  it('compares amounts', () => {
    expect(compareMoney('10.00', '9.99')).toBe(1);
    expect(compareMoney('9.99', '10')).toBe(-1);
    expect(compareMoney('10', '10.00')).toBe(0);
  });

  it('formats with currency and grouping', () => {
    expect(formatMoney('1250.5')).toBe('PKR 1,250.50');
    expect(formatMoney('1234567')).toBe('PKR 1,234,567.00');
    expect(formatMoney('5', 'USD')).toBe('USD 5.00');
    expect(formatMoney(null)).toBe('');
    expect(formatMoney('abc')).toBe('');
  });

  it('validator accepts empty and valid, rejects invalid', () => {
    expect(moneyValidator(new FormControl(''))).toBeNull();
    expect(moneyValidator(new FormControl(null))).toBeNull();
    expect(moneyValidator(new FormControl('12.50'))).toBeNull();
    expect(moneyValidator(new FormControl('12.345'))).toEqual({ money: true });
  });
});