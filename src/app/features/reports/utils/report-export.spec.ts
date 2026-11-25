import { describe, expect, it } from 'vitest';
import { buildWorkbook, colWidths, inDateRange, isoToLocalDate, safeSheetName } from './report-utils';

describe('excel export helpers', () => {
  it('makes a valid sheet name', () => {
    expect(safeSheetName('Profit & loss')).toBe('Profit & loss');
    expect(safeSheetName('a/b:c?d*e[f]g\\h')).toBe('a b c d e f g h');
    expect(safeSheetName('x'.repeat(40))).toHaveLength(31);
    expect(safeSheetName('   ')).toBe('Sheet1');
  });

  it('sizes columns from the longest cell, with a limit', () => {
    expect(colWidths(['A', 'Name'], [[1, 'Dell Latitude'], [22, null]])).toEqual([4, 15]);
    expect(colWidths(['A'], [['x'.repeat(200)]])).toEqual([60]);
    expect(colWidths(['Only header'], [])).toEqual([13]);
  });

  it('filters by local date, both ends included', () => {
    const noon = new Date(2026, 10, 4, 12, 0, 0).toISOString();
    expect(isoToLocalDate(noon)).toBe('2026-11-04');
    expect(inDateRange(noon, '2026-11-04', '2026-11-04')).toBe(true);
    expect(inDateRange(noon, '2026-11-05', '2026-11-30')).toBe(false);
    expect(inDateRange(noon, '2026-11-01', '2026-11-03')).toBe(false);
    expect(inDateRange(noon, '', '')).toBe(true);
  });

  it('builds a workbook where text stays text (no formulas)', async () => {
    const wb = await buildWorkbook('Prints', ['When', 'Reason'], [['2026-11-04', '=1+1'], ['2026-11-05', null]]);
    expect(wb.SheetNames).toEqual(['Prints']);
    const ws = wb.Sheets['Prints'];
    expect(ws['A1'].v).toBe('When');
    expect(ws['B2'].t).toBe('s');
    expect(ws['B2'].v).toBe('=1+1');
  });
});