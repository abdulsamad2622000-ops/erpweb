import { describe, expect, it } from 'vitest';
import { Product } from '../../../features/products/models';
import { ProductPriceChange } from '../../../features/products/services/price-history.service';
import { PRICE_HISTORY_FIXTURES } from './price-history.fixtures';
import { PRODUCT_FIXTURES } from './products.fixtures';

const req = (method: string, url: string, body: unknown = null) => ({ method, url, body });

describe('price history fixtures', () => {
  it('lists seeded history newest first', () => {
    const rows = PRICE_HISTORY_FIXTURES['GET /products/:id/history'](req('GET', '/api/v1/products/1/history')).body as ProductPriceChange[];
    expect(rows.length).toBeGreaterThanOrEqual(2);
    expect(rows[0].changedAt >= rows[1].changedAt).toBe(true);
  });

  it('records a change when a price is saved', () => {
    const current = PRODUCT_FIXTURES['GET /products/:id'](req('GET', '/api/v1/products/1')).body as Product;
    const prices = (current.prices ?? []).map((p) => (p.tier === 'retail' ? { ...p, price: 170000 } : p));
    const res = PRICE_HISTORY_FIXTURES['PUT /products/:id'](req('PUT', '/api/v1/products/1', { ...current, prices }));
    expect(res.status).toBeLessThan(400);
    const rows = PRICE_HISTORY_FIXTURES['GET /products/:id/history'](req('GET', '/api/v1/products/1/history')).body as ProductPriceChange[];
    expect(rows.find((r) => r.newPrice === 170000)).toMatchObject({ tier: 'retail', oldPrice: 165000 });
  });
});