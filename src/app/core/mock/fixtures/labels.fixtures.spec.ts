import { describe, expect, it } from 'vitest';
import { LabelItem, PrintLogEntry } from '../../../features/labels/models/label.models';
import { LABEL_FIXTURES } from './labels.fixtures';

const call = (key: string, url: string, body: unknown = null) =>
  LABEL_FIXTURES[key]({ method: key.split(' ')[0], url, body });

describe('label fixtures', () => {
  it('GRN se serials filter hote hain', () => {
    const res = call('GET /labels/items', '/labels/items?kind=serial&q=&grn=GRN-0042');
    expect((res.body as LabelItem[]).map((i) => i.code)).toEqual(['5CG3412XYZ', '5CG3412XYA', '5CG3412XYB']);
  });

  it('scan lookup serial dhoondta hai, warna 404', () => {
    expect((call('GET /labels/lookup/:id', '/labels/lookup/5cd2219hpq').body as LabelItem).kind).toBe('serial');
    expect(call('GET /labels/lookup/:id', '/labels/lookup/NOPE').status).toBe(404);
  });

  it('pehli dafa print theek, reprint bina wajah ke 422', () => {
    const first = call('POST /labels/print-log', '/labels/print-log', { templateId: 1, codes: ['5CG3412XYZ'], reason: null });
    expect((first.body as PrintLogEntry).isReprint).toBe(false);
    expect(call('POST /labels/print-log', '/labels/print-log', { templateId: 1, codes: ['5CG3412XYZ'], reason: null }).status).toBe(422);
    const again = call('POST /labels/print-log', '/labels/print-log', { templateId: 1, codes: ['5CG3412XYZ'], reason: 'Label damaged in shop' });
    expect((again.body as PrintLogEntry).isReprint).toBe(true);
  });

  it('template ka size check hota hai', () => {
    const bad = { name: 'x', kind: 'sku', widthMm: 5, heightMm: 5, symbology: 'qr', fields: ['name'], showLogo: false, isDefault: false };
    expect(call('POST /labels/templates', '/labels/templates', bad).status).toBe(422);
  });
});
