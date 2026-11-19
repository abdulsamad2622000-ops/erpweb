import { describe, expect, it } from 'vitest';
import { PRODUCT_FIXTURES } from './products.fixtures';

const call = (key: string, url: string, body: unknown = null) =>
  PRODUCT_FIXTURES[key]({ method: key.split(' ')[0], url, body });

const make = (body: unknown) => call('POST /categories', '/categories', body);
const idOf = (res: { body: unknown }) => (res.body as { id: number }).id;

describe('category tree fixtures', () => {
  it('lists categories with parentId', () => {
    const rows = (call('GET /categories', '/categories?pageSize=100').body as { data: { id: number; parentId: number | null }[] }).data;
    expect(rows.find((r) => r.id === 3)?.parentId).toBe(1);
  });

  it('allows the same name under different parents but not under the same parent', () => {
    const a = make({ name: 'Workstations', parentId: 2, isActive: true });
    expect(a.status).toBe(200);
    expect(make({ name: 'workstations', parentId: 1, isActive: true }).status).toBe(200);
    expect(make({ name: 'WORKSTATIONS', parentId: 2, isActive: true }).status).toBe(422);
  });

  it('rejects an unknown parent', () => {
    expect(make({ name: 'Ghost', parentId: 999, isActive: true }).status).toBe(422);
  });

  it('cannot move a category inside itself or its own child', () => {
    const put = (id: number, parentId: number | null) =>
      call('PUT /categories/:id', `/categories/${id}`, { name: 'Laptops', parentId, isActive: true });
    expect(put(1, 1).status).toBe(422);
    expect(put(1, 3).status).toBe(422);
    expect(put(1, null).status).toBe(200);
  });

  it('blocks deleting a category that has children, allows it after they are gone', () => {
    const parent = idOf(make({ name: 'Tablets', parentId: null, isActive: true }));
    const child = idOf(make({ name: 'Rugged Tablets', parentId: parent, isActive: true }));
    expect(call('DELETE /categories/:id', `/categories/${parent}`).status).toBe(409);
    expect(call('DELETE /categories/:id', `/categories/${child}`).status).toBe(200);
    expect(call('DELETE /categories/:id', `/categories/${parent}`).status).toBe(200);
  });
});