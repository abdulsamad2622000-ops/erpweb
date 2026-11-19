import { describe, expect, it } from 'vitest';
import { SETTINGS_FIXTURES } from './settings.fixtures';

const call = (key: string, url: string, body: unknown = null) =>
  SETTINGS_FIXTURES[key]({ method: key.split(' ')[0], url, body });

const companyOf = () => call('GET /settings/company', '/settings/company').body as Record<string, unknown>;

describe('SETTINGS_FIXTURES', () => {
  it('company: reads and updates', () => {
    const updated = call('PUT /settings/company', '/settings/company', { ...companyOf(), name: 'Acme Computers' });
    expect(updated.status).toBe(200);
    expect(companyOf()['name']).toBe('Acme Computers');
  });

  it('company: rejects empty name, bad email, bad tax rate and unknown currency', () => {
    const base = companyOf();
    expect(call('PUT /settings/company', '/settings/company', { ...base, name: '  ' }).status).toBe(422);
    expect(call('PUT /settings/company', '/settings/company', { ...base, email: 'nope' }).status).toBe(422);
    expect(call('PUT /settings/company', '/settings/company', { ...base, taxRate: 120 }).status).toBe(422);
    expect(call('PUT /settings/company', '/settings/company', { ...base, currency: 'XXX' }).status).toBe(422);
  });

  it('number series: updates a series', () => {
    const res = call('PUT /settings/number-series/:id', '/settings/number-series/1', {
      prefix: 'PO-',
      nextNumber: 5,
      padding: 6,
      resetYearly: false,
    });
    expect(res.status).toBe(200);
    const list = call('GET /settings/number-series', '/settings/number-series').body as { id: number; nextNumber: number }[];
    expect(list.find((s) => s.id === 1)?.nextNumber).toBe(5);
  });

  it('number series: rejects bad prefix, duplicate prefix, bad number and bad digits', () => {
    const put = (body: unknown) => call('PUT /settings/number-series/:id', '/settings/number-series/1', body).status;
    expect(put({ prefix: 'bad prefix!', nextNumber: 1, padding: 6, resetYearly: false })).toBe(422);
    expect(put({ prefix: 'GRN-', nextNumber: 1, padding: 6, resetYearly: false })).toBe(422);
    expect(put({ prefix: 'PO-', nextNumber: 0, padding: 6, resetYearly: false })).toBe(422);
    expect(put({ prefix: 'PO-', nextNumber: 1, padding: 2, resetYearly: false })).toBe(422);
  });

  it('number series: unknown id gives 404', () => {
    const res = call('PUT /settings/number-series/:id', '/settings/number-series/99', {
      prefix: 'X-',
      nextNumber: 1,
      padding: 6,
      resetYearly: false,
    });
    expect(res.status).toBe(404);
  });

  it('price tiers: rename works, duplicate name fails, retail cannot be disabled', () => {
    const put = (id: number, body: unknown) => call('PUT /settings/price-tiers/:id', `/settings/price-tiers/${id}`, body);
    expect(put(2, { name: 'Bulk', isActive: true }).status).toBe(200);
    expect(put(3, { name: 'bulk', isActive: true }).status).toBe(422);
    expect(put(1, { name: 'Retail', isActive: false }).status).toBe(422);
    expect(put(3, { name: 'Dealer', isActive: false }).status).toBe(200);
  });

  it('costing: updates and rejects invalid values', () => {
    expect(call('PUT /settings/costing', '/settings/costing', { method: 'serial_specific', negativeStock: 'warn' }).status).toBe(200);
    expect(call('GET /settings/costing', '/settings/costing').body).toEqual({
      method: 'serial_specific',
      negativeStock: 'warn',
    });
    expect(call('PUT /settings/costing', '/settings/costing', { method: 'lifo', negativeStock: 'warn' }).status).toBe(422);
    expect(call('PUT /settings/costing', '/settings/costing', { method: 'fifo', negativeStock: 'maybe' }).status).toBe(422);
  });

  it('backup: can be read', () => {
    const res = call('GET /settings/backup', '/settings/backup');
    expect(res.status).toBe(200);
    expect((res.body as { frequency: string }).frequency).toBe('daily');
  });
});