import { describe, expect, it } from 'vitest';
import { buildPrintDocument, escapeHtml } from './print-utils';

describe('escapeHtml', () => {
  it('khatarnak characters escape karta hai', () => {
    expect(escapeHtml('<img src=x onerror="a()">&\'')).toBe(
      '&lt;img src=x onerror=&quot;a()&quot;&gt;&amp;&#39;',
    );
  });
  it('null aur number sambhalta hai', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(12.5)).toBe('12.5');
  });
});

describe('buildPrintDocument', () => {
  it('A4 aur 80mm ka page size alag hai', () => {
    expect(buildPrintDocument('x', '<p>a</p>', 'a4')).toContain('size: A4');
    expect(buildPrintDocument('x', '<p>a</p>', 'thermal80')).toContain('size: 80mm auto');
  });
  it('title escape hota hai aur dir lagta hai', () => {
    const doc = buildPrintDocument('<b>', '', 'a4', 'rtl');
    expect(doc).toContain('<title>&lt;b&gt;</title>');
    expect(doc).toContain('dir="rtl"');
  });
});
