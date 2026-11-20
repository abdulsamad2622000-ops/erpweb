import { beforeAll, describe, expect, it } from 'vitest';
import { renderBarcodeSvg } from './barcode-render';
import { renderLabelSheet, moneyPkr } from './label-render';
import { SAMPLE_ITEMS } from './sample-items';

describe('label render (asal libraries)', () => {
  // jsdom mein canvas nahi; JsBarcode sirf text ki chaurai naapta hai.
  beforeAll(() => {
    HTMLCanvasElement.prototype.getContext = (() => ({ font: '', measureText: () => ({ width: 50 }) })) as never;
  });

  it('Code128, QR aur EAN-13 SVG banate hain', async () => {
    expect(await renderBarcodeSvg('5CG3412XYZ', 'code128')).toContain('<svg');
    expect(await renderBarcodeSvg('BIN-A-03-2', 'qr')).toContain('<svg');
    expect(await renderBarcodeSvg('8901234567890', 'ean13')).toContain('<svg');
  });

  it('sample data se 3 serial labels ki batch sheet banti hai', async () => {
    const items = ['A1', 'A2', 'A3'].map((s) => ({ ...SAMPLE_ITEMS.serial, code: s, serial: s }));
    const tpl = { id: 1, name: 'T', kind: 'serial' as const, widthMm: 62, heightMm: 32, symbology: 'code128' as const,
      fields: ['name', 'serial'] as const, showLogo: false, isDefault: true };
    const html = await renderLabelSheet({ ...tpl, fields: [...tpl.fields] }, items, { company: '', logoUrl: null, money: moneyPkr });
    expect(html.match(/<svg/g)?.length).toBe(3);
    expect(html).toContain('A3');
  });
});
