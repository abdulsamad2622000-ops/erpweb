import { describe, expect, it } from 'vitest';
import { LabelItem, LabelTemplate } from '../models/label.models';
import { fitContain, fitText, labelPdfName, pdfLayout, pdfSafe, svgSize } from './label-pdf-layout';
import { SIZE_PRESETS, labelLines } from './label-utils';

const item: LabelItem = {
  kind: 'serial', code: 'SN123', name: 'Dell Latitude', sku: 'DL-1', serial: 'SN123', specs: null, price: 1500, bin: 'A-1', grn: null, printCount: 0,
};
const tpl = (symbology: LabelTemplate['symbology'], fields: LabelTemplate['fields']): LabelTemplate => ({
  id: 1, name: 't', kind: 'serial', widthMm: 62, heightMm: 32, symbology, fields, showLogo: false, isDefault: true,
});
const opts = { company: 'Shop', logoUrl: null, money: (n: number) => `Rs ${n}` };

describe('pdfLayout', () => {
  it('keeps text and barcode inside the page and apart, for every preset', () => {
    for (const p of SIZE_PRESETS) {
      for (const qr of [true, false]) {
        for (const lines of [0, 1, 3, 8]) {
          const L = pdfLayout(p.widthMm, p.heightMm, qr, lines);
          expect(L.barcode.x).toBeGreaterThanOrEqual(0);
          expect(L.barcode.y).toBeGreaterThanOrEqual(0);
          expect(L.barcode.x + L.barcode.w).toBeLessThanOrEqual(p.widthMm + 1e-9);
          expect(L.barcode.y + L.barcode.h).toBeLessThanOrEqual(p.heightMm + 1e-9);
          expect(L.barcode.w).toBeGreaterThan(0);
          expect(L.barcode.h).toBeGreaterThan(0);
          if (qr) expect(L.text.x + L.text.w).toBeLessThanOrEqual(L.barcode.x);
          else expect(L.text.y + L.maxLines * L.lineMm).toBeLessThanOrEqual(L.barcode.y + 1e-9);
        }
      }
    }
  });

  it('QR sits on the right as a square; linear barcode goes under the text', () => {
    const q = pdfLayout(50, 25, true, 2);
    expect(q.barcode.w).toBe(q.barcode.h);
    expect(q.barcode.x).toBeGreaterThan(q.text.x);
    const l = pdfLayout(62, 32, false, 3);
    expect(l.barcode.y).toBeGreaterThan(l.text.y);
    expect(l.maxLines).toBe(3);
  });

  it('with no text the barcode takes the whole label', () => {
    const l = pdfLayout(62, 32, false, 0);
    expect(l.maxLines).toBe(0);
    expect(l.barcode.y).toBeCloseTo(1.5);
  });
});

describe('pdf helpers', () => {
  it('fitContain keeps the shape and centres it', () => {
    const r = fitContain(100, 50, { x: 0, y: 0, w: 40, h: 40 });
    expect(r.w).toBe(40);
    expect(r.h).toBe(20);
    expect(r.y).toBe(10);
  });

  it('svgSize reads the viewBox', () => {
    expect(svgSize('<svg viewBox="0 0 120 45.5" width="100%">')).toEqual({ w: 120, h: 45.5 });
    expect(svgSize('<svg width="10">')).toBeNull();
    expect(svgSize('<svg viewBox="0 0 0 0">')).toBeNull();
  });

  it('fitText shortens only when needed', () => {
    const measure = (s: string): number => s.length;
    expect(fitText('abc', 5, measure)).toBe('abc');
    expect(fitText('abcdefghij', 6, measure)).toBe('abc...');
  });

  it('pdfSafe replaces characters the PDF font cannot draw', () => {
    expect(pdfSafe('Dell \u2013 16GB')).toBe('Dell ? 16GB');
    expect(pdfSafe('Caf\u00e9')).toBe('Caf\u00e9');
    expect(pdfSafe('\u0627\u0631\u062f\u0648')).toBe('????');
  });

  it('builds a dated file name', () => {
    expect(labelPdfName('serial', new Date(2026, 10, 4))).toBe('labels-serial-2026-11-04.pdf');
  });
});

describe('labelLines', () => {
  it('skips empty values and hides the code line unless the label is a QR', () => {
    const fields: LabelTemplate['fields'] = ['name', 'specs', 'price', 'code'];
    expect(labelLines(tpl('code128', fields), item, opts)).toEqual(['Dell Latitude', 'Rs 1500']);
    expect(labelLines(tpl('qr', fields), item, opts)).toEqual(['Dell Latitude', 'Rs 1500', 'SN123']);
  });
});