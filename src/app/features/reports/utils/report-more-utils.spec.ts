import { describe, expect, it } from 'vitest';
import { abcAnalysis, classifyMovement } from './report-more-utils';

describe('abcAnalysis', () => {
  it('classes by cumulative revenue share', () => {
    const r = abcAnalysis([
      { key: 'a', label: 'A', revenue: 80 }, { key: 'b', label: 'B', revenue: 15 },
      { key: 'c', label: 'C', revenue: 5 }, { key: 'z', label: 'Z', revenue: 0 },
    ]);
    expect(r.map((x) => x.cls)).toEqual(['A', 'B', 'C']);
    expect(r[2].cumulative).toBe(100);
  });
});

describe('classifyMovement', () => {
  it('finds dead, slow and fast stock', () => {
    expect(classifyMovement(0, 5, 120)).toBe('dead');
    expect(classifyMovement(0, 5, 10)).toBe('slow');
    expect(classifyMovement(1, 10, 30)).toBe('slow');
    expect(classifyMovement(5, 10, 30)).toBe('fast');
  });
});
