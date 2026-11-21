import { describe, expect, it } from 'vitest';
import { checkScan, scanProblemKey } from './scan-checklist';

describe('checkScan', () => {
  const expected = ['SN0001', 'SN0002'];

  it('expected aur nayi serial ok hai (chhote aksar aur space ke saath bhi)', () => {
    expect(checkScan(expected, [], ' sn0001 ')).toEqual({ kind: 'ok', serial: 'SN0001' });
  });

  it('pehle scan ho chuki serial duplicate hai', () => {
    expect(checkScan(expected, ['SN0001'], 'SN0001').kind).toBe('duplicate');
  });

  it('galat format invalid hai', () => {
    expect(checkScan(expected, [], '!!').kind).toBe('invalid');
  });

  it('expected mein na ho to unknown, allowExtra par extra', () => {
    expect(checkScan(expected, [], 'SN9999').kind).toBe('unknown');
    expect(checkScan(expected, [], 'SN9999', true).kind).toBe('extra');
  });

  it('scanProblemKey sahi key deta hai', () => {
    expect(scanProblemKey('invalid', 'x')).toBe('purchase.grn.why.invalid_format');
    expect(scanProblemKey('duplicate', 'x')).toBe('purchase.grn.why.duplicate_here');
    expect(scanProblemKey('unknown', 'x')).toBe('x');
  });
});