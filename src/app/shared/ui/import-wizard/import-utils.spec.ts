import { describe, expect, it } from 'vitest';
import { ImportField, autoMap, parseCsv, validateRows } from './import-utils';

const FIELDS: ImportField[] = [
  { key: 'sku', label: 'SKU', required: true, unique: true },
  { key: 'price', label: 'Price', required: true, type: 'number' },
  { key: 'expiry', label: 'Expiry', type: 'date' },
];

describe('parseCsv', () => {
  it('quotes, comma aur CRLF sambhalta hai', () => {
    const rows = parseCsv('a,b\r\n"x, y","he said ""hi"""\r\n\r\n');
    expect(rows).toEqual([
      ['a', 'b'],
      ['x, y', 'he said "hi"'],
    ]);
  });
  it('BOM hata deta hai', () => {
    expect(parseCsv('\uFEFFsku,price\n1,2')[0][0]).toBe('sku');
  });
});

describe('autoMap', () => {
  it('label aur key se match karta hai', () => {
    expect(autoMap(['Price', 'sku', 'Other'], FIELDS)).toEqual([1, 0, -1]);
  });
});

describe('validateRows', () => {
  it('required, number, date aur duplicate pakadta hai', () => {
    const rows = validateRows(
      [
        ['A1', '1,250.50', '2027-01-31'],
        ['a1', 'abc', '31/01/2027'],
        ['', '5', ''],
      ],
      [0, 1, 2],
      FIELDS,
    );
    expect(rows[0].errors).toEqual([]);
    expect(rows[0].values['price']).toBe(1250.5);
    expect(rows[1].errors).toContain('SKU is duplicated in the file');
    expect(rows[1].errors).toContain('Price must be a number');
    expect(rows[2].errors).toEqual(['SKU is required']);
    expect(rows[2].line).toBe(4);
  });
});
