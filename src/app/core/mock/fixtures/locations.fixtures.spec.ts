import { describe, expect, it } from 'vitest';
import { ORG_FIXTURES } from './org.fixtures';

const call = (key: string, url: string, body: unknown = null) =>
  ORG_FIXTURES[key]({ method: key.split(' ')[0], url, body });

const bin = { warehouseId: 1, parentId: 3, level: 'bin', code: 'b03', name: 'Bin 03', isActive: true };

describe('location fixtures', () => {
  it('lists one warehouse only', () => {
    const res = call('GET /locations', '/locations?warehouseId=1&pageSize=100');
    expect((res.body as { total: number }).total).toBeGreaterThanOrEqual(6);
    const none = call('GET /locations', '/locations?warehouseId=2&pageSize=100');
    expect((none.body as { total: number }).total).toBe(0);
  });

  it('creates a bin with a barcode and can delete it', () => {
    const created = call('POST /locations', '/locations', bin);
    expect(created.status).toBe(200);
    const row = created.body as { id: number; barcode: string; code: string };
    expect(row.code).toBe('B03');
    expect(row.barcode).toBe('BIN-LHR-SELL-A-R1-S1-B03');
    expect(call('DELETE /locations/:id', `/locations/${row.id}`).status).toBe(200);
  });

  it('rejects wrong level and duplicate code under the same parent', () => {
    expect(call('POST /locations', '/locations', { ...bin, parentId: 1 }).status).toBe(422);
    expect(call('POST /locations', '/locations', { ...bin, code: 'B01' }).status).toBe(422);
  });

  it('blocks deleting a location with children (409), and a warehouse with locations', () => {
    expect(call('DELETE /locations/:id', '/locations/1').status).toBe(409);
    expect(call('DELETE /warehouses/:id', '/warehouses/1').status).toBe(409);
  });

  it('edit keeps the barcode', () => {
    const res = call('PUT /locations/:id', '/locations/4', { ...bin, code: 'B01', name: 'Bin One' });
    expect((res.body as { barcode: string }).barcode).toBe('BIN-LHR-SELL-A-R1-S1-B01');
  });
});