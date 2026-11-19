import { describe, expect, it } from 'vitest';
import { buildBinLabelSheet } from './bin-label';

describe('buildBinLabelSheet', () => {
  it('escapes text but keeps the svg', () => {
    const html = buildBinLabelSheet([{ title: 'A<b>', caption: 'x & y', svg: '<svg></svg>' }]);
    expect(html).toContain('A&lt;b&gt;');
    expect(html).toContain('x &amp; y');
    expect(html).toContain('<svg></svg>');
  });
});