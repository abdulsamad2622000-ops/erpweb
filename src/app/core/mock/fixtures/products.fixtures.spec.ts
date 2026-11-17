import { describe, expect, it } from 'vitest';
import { PRODUCT_FIXTURES } from './products.fixtures';

const call = (key: string, url: string, body: unknown = null) =>
  PRODUCT_FIXTURES[key]({ method: key.split(' ')[0], url, body });

const namesOf = (res: { body: unknown }): string[] =>
  (res.body as { data: { name: string }[] }).data.map((r) => r.name);

const sample = { sku: 'NEW-001', name: 'Sample', barcode: null, brandId: 1, categoryId: 1, trackBatch: false, isActive: true };

describe('PRODUCT_FIXTURES', () => {
  it('scope: Accessories category aur Mouse product nahi hain', () => {
    expect(namesOf(call('GET /categories', '/categories?pageSize=100'))).not.toContain('Accessories');
    expect(namesOf(call('GET /products', '/products?pageSize=100')).join(' ')).not.toMatch(/mouse/i);
  });

  it('search filter kaam karta hai', () => {
    const res = call('GET /brands', '/brands?search=dell');
    expect(namesOf(res)).toEqual(['Dell']);
  });

  it('jo brand product mein use ho wo delete par 409 deta hai', () => {
    expect(call('DELETE /brands/:id', '/brands/1').status).toBe(409);
  });

  it('jo category product mein use ho wo delete par 409 deta hai', () => {
    expect(call('DELETE /categories/:id', '/categories/1').status).toBe(409);
  });

  it('duplicate SKU par 422 aata hai', () => {
    expect(call('POST /products', '/products', { ...sample, sku: 'LAP-DELL-001' }).status).toBe(422);
  });

  it('naya category banta hai, duplicate naam par 422, aur unused delete ho jata hai', () => {
    const created = call('POST /categories', '/categories', { name: 'Servers', isActive: true });
    expect(created.status).toBe(200);
    const id = (created.body as { id: number }).id;
    expect(call('POST /categories', '/categories', { name: 'servers', isActive: true }).status).toBe(422);
    expect(call('DELETE /categories/:id', `/categories/${id}`).status).toBe(200);
  });

  it('product edit aur delete chalta hai', () => {
    const created = call('POST /products', '/products', sample);
    const id = (created.body as { id: number }).id;
    const edited = call('PUT /products/:id', `/products/${id}`, { ...sample, name: 'Edited' });
    expect((edited.body as { name: string }).name).toBe('Edited');
    expect(call('DELETE /products/:id', `/products/${id}`).status).toBe(200);
    expect(call('GET /products/:id', `/products/${id}`).status).toBe(404);
  });
});