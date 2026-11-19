import { describe, expect, it } from 'vitest';
import { LABEL_FIXTURES } from './labels.fixtures';

const call = (key: string, url: string, body: unknown = null) =>
  LABEL_FIXTURES[key]({ method: key.split(' ')[0], url, body });

describe('label fixtures', () => {
  it('filters items by kind', () => {
    const res = call('GET /labels/items', '/api/v1/labels/items?page=1&pageSize=50&kind=bin');
    const body = res.body as { data: { kind: string }[] };
    expect(body.data.length).toBeGreaterThan(0);
    expect(body.data.every((i) => i.kind === 'bin')).toBe(true);
  });

  it('finds an item by scanned value and 404s otherwise', () => {
    expect(call('GET /labels/lookup', '/api/v1/labels/lookup?value=cn0x7k2l8d').status).toBe(200);
    expect(call('GET /labels/lookup', '/api/v1/labels/lookup?value=nope').status).toBe(404);
  });

  it('requires a reason of 10+ characters to reprint', () => {
    const base = { templateId: 1, kind: 'reprint', values: ['CN0X7K2L8D'], labelCount: 1 };
    expect(call('POST /labels/print-log', '/api/v1/labels/print-log', { ...base, reason: 'torn' }).status).toBe(422);
    expect(call('POST /labels/print-log', '/api/v1/labels/print-log', { ...base, reason: 'Label torn during transfer' }).status).toBe(200);
  });

  it('validates templates and keeps one default', () => {
    const bad = call('POST /labels/templates', '/api/v1/labels/templates', {
      name: 'Tiny', widthMm: 5, heightMm: 5, symbology: 'qr', fields: [], showLogo: false, isDefault: false,
    });
    expect(bad.status).toBe(422);
    const okRes = call('POST /labels/templates', '/api/v1/labels/templates', {
      name: 'Shelf 100x50', widthMm: 100, heightMm: 50, symbology: 'qr', fields: ['title'], showLogo: false, isDefault: true,
    });
    expect(okRes.status).toBe(200);
    const list = call('GET /labels/templates', '/api/v1/labels/templates').body as { isDefault: boolean }[];
    expect(list.filter((t) => t.isDefault).length).toBe(1);
  });

  it('does not delete the default template', () => {
    const list = call('GET /labels/templates', '/api/v1/labels/templates').body as { id: number; isDefault: boolean }[];
    const def = list.find((t) => t.isDefault)!;
    expect(call('DELETE /labels/templates/:id', `/api/v1/labels/templates/${def.id}`).status).toBe(409);
  });
});
