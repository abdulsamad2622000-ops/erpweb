import { ValidatorFn } from '@angular/forms';

/**
 * Money is a decimal string ("1250.50"), never a float.
 * All math goes through BigInt cents. Backend: Laravel decimal(15,2).
 */

/** "1,250.5" -> "1250.50". Returns null when the text is not a valid non-negative amount. */
export function normalizeMoney(raw: string): string | null {
  const s = raw.replace(/[,\s]/g, '');
  if (!/^\d+(\.\d{0,2})?$/.test(s)) return null;
  const [intPart, frac = ''] = s.split('.');
  const cleanInt = intPart.replace(/^0+(?=\d)/, '');
  return `${cleanInt}.${frac.padEnd(2, '0')}`;
}

export function toCents(value: string): bigint {
  const n = normalizeMoney(value);
  if (n === null) throw new Error(`Invalid money value: ${value}`);
  return BigInt(n.replace('.', ''));
}

export function compareMoney(a: string, b: string): -1 | 0 | 1 {
  const x = toCents(a);
  const y = toCents(b);
  if (x === y) return 0;
  return x < y ? -1 : 1;
}

/** "1250.5" -> "PKR 1,250.50". Invalid input gives an empty string. */
export function formatMoney(value: string | null | undefined, currency = 'PKR'): string {
  if (value === null || value === undefined) return '';
  const n = normalizeMoney(value);
  if (n === null) return '';
  const [intPart, frac] = n.split('.');
  const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${currency} ${grouped}.${frac}`;
}

/** Validator for money controls. Empty is valid (combine with Validators.required). */
export const moneyValidator: ValidatorFn = (control) => {
  const v: unknown = control.value;
  if (v === null || v === undefined || v === '') return null;
  return typeof v === 'string' && normalizeMoney(v) !== null ? null : { money: true };
};