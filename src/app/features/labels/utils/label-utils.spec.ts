import { describe, expect, it } from 'vitest';
import { LabelTemplate } from '../models/label.models';
import { SAMPLE_ITEMS } from './sample-items';
import { buildLabelSheet, ean13CheckDigit, effectiveSymbology, isValidEan13, needsReprintReason } from './label-utils';

const tpl = (o: Partial<LabelTemplate> = {}): LabelTemplate => ({
  id: 1, name: 'T', kind: 'serial', widthMm: 62, heightMm: 32, symbology: 'code128',
  fields: ['name', 'specs', 'serial'], showLogo: false, isDefault: true, ...o,
});
const opts = { company: 'Acme', logoUrl: null, money: (n: number) => `Rs ${n}` };

describe('label utils', () => {
  it('EAN-13 check digit sahi nikalta hai', () => {
    expect(ean13CheckDigit('890123456789')).toBe(0);
    expect(ean13CheckDigit('400638133393')).toBe(1);
    expect(isValidEan13('8901234567890')).toBe(true);
    expect(isValidEan13('8901234567894')).toBe(false);
    expect(isValidEan13('5CG3412XYZ')).toBe(false);
  });

  it('ghalat EAN par Code128 par wapas jata hai', () => {
    expect(effectiveSymbology('ean13', '5CG3412XYZ')).toBe('code128');
    expect(effectiveSymbology('ean13', '8901234567890')).toBe('ean13');
    expect(effectiveSymbology('qr', 'anything')).toBe('qr');
  });

  it('pehle print hua item reprint maana jata hai', () => {
    expect(needsReprintReason([SAMPLE_ITEMS.serial])).toBe(false);
    expect(needsReprintReason([{ ...SAMPLE_ITEMS.serial, printCount: 1 }])).toBe(true);
  });

  it('sheet mein har item ka label, size aur chune hue fields aate hain', () => {
    const items = [SAMPLE_ITEMS.serial, { ...SAMPLE_ITEMS.serial, code: 'X2', serial: 'X2' }];
    const html = buildLabelSheet(tpl(), items, ['<svg id="a"></svg>', '<svg id="b"></svg>'], opts);
    expect(html.match(/class="lbl /g)?.length).toBe(2);
    expect(html).toContain('width:62mm;height:32mm');
    expect(html).toContain('Dell Latitude 5440');
    expect(html).toContain('X2');
    expect(html).toContain('<svg id="b">');
    expect(html).not.toContain('Rs 165000');
  });

  it('text escape hota hai', () => {
    const evil = { ...SAMPLE_ITEMS.sku, name: '<script>x</script>' };
    const html = buildLabelSheet(tpl({ fields: ['name', 'price'] }), [evil], [''], opts);
    expect(html).not.toContain('<script>');
    expect(html).toContain('Rs 1800');
  });
});
