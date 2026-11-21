import { describe, expect, it } from 'vitest';
import { barHeights, monthRange, toCsv } from './report-utils';

describe('report utils', () => {
  it('builds safe csv', () => {
    expect(toCsv(['A', 'B'], [['x"y', 5], ['=SUM(1)', null]])).toBe('"A","B"\r\n"x""y","5"\r\n"\'=SUM(1)",""');
    expect(toCsv(['N'], [[-5]])).toBe('"N"\r\n"-5"');
  });
  it('scales bars', () => {
    expect(barHeights([0, 50, 100])).toEqual([0, 50, 100]);
    expect(barHeights([0, 0])).toEqual([0, 0]);
  });
  it('month range', () => {
    expect(monthRange(new Date(2026, 10, 21))).toEqual({ from: '2026-11-01', to: '2026-11-21' });
  });
});
