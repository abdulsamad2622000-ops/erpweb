import { describe, expect, it } from 'vitest';
import { LabelItem, LabelTemplate } from '../models/barcode.models';
import { labelCss, labelHtml, labelsBody, totalLabels } from './label-html';

const tpl: LabelTemplate = {
  id: 1, name: 'T', widthMm: 50, heightMm: 25, symbology: 'code128',
  fields: ['title', 'value', 'price'], showLogo: false, isDefault: true,
};
const item: LabelItem = { id: 's1', kind: 'serial', value: 'SN<1>', title: 'Dell <b>5440</b>', subtitle: 'x', price: 1000 };
const ctx = { companyName: 'Demo & Co', logoUrl: null, formatPrice: (n: number) => `Rs ${n}` };

describe('label-html', () => {
  it('sets the page size from the template', () => {
    expect(labelCss(tpl)).toContain('size: 50mm 25mm');
  });

  it('escapes user text and shows only the chosen fields', () => {
    const html = labelHtml(tpl, { item, svg: '<svg></svg>', copies: 1 }, ctx);
    expect(html).toContain('Dell &lt;b&gt;5440&lt;/b&gt;');
    expect(html).toContain('SN&lt;1&gt;');
    expect(html).toContain('Rs 1000');
    expect(html).not.toContain('Demo');
    expect(html).not.toContain('class="s"');
  });

  it('repeats a label for each copy', () => {
    const body = labelsBody(tpl, [{ item, svg: '<svg></svg>', copies: 3 }], ctx);
    expect(body.match(/class="lbl"/g)?.length).toBe(3);
    expect(totalLabels([{ copies: 3 }, { copies: 2 }])).toBe(5);
  });
});
