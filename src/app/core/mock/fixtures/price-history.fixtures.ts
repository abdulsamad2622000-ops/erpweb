import { Product } from '../../../features/products/models';
import { ProductPriceChange } from '../../../features/products/services/price-history.service';
import { FixtureHandler, ok } from './fixture.types';
import { PRODUCT_FIXTURES } from './products.fixtures';

const TIERS = ['retail', 'wholesale', 'dealer'] as const;

const history: ProductPriceChange[] = [
  { id: 1, productId: 1, tier: 'retail', oldPrice: 160000, newPrice: 165000, changedAt: '2026-09-01T10:00:00.000Z', changedBy: 'Super Admin' },
  { id: 2, productId: 1, tier: 'dealer', oldPrice: 149000, newPrice: 151000, changedAt: '2026-09-15T09:30:00.000Z', changedBy: 'Admin' },
];
let nextId = 100;

const idOf = (url: string): number => Number(url.split('?')[0].split('/').pop());
const historyIdOf = (url: string): number => Number(url.split('?')[0].split('/').slice(-2)[0]);
const priceOf = (p: Partial<Product> | undefined, tier: (typeof TIERS)[number]): number | null =>
  p?.prices?.find((x) => x.tier === tier)?.price ?? null;

function record(productId: number, before: Partial<Product> | undefined, after: Partial<Product>): void {
  for (const tier of TIERS) {
    const oldPrice = priceOf(before, tier);
    const newPrice = priceOf(after, tier);
    if (oldPrice === newPrice) continue;
    history.push({ id: nextId++, productId, tier, oldPrice, newPrice, changedAt: new Date().toISOString(), changedBy: 'Mock user' });
  }
}

const getOne = PRODUCT_FIXTURES['GET /products/:id'];
const put = PRODUCT_FIXTURES['PUT /products/:id'];
const post = PRODUCT_FIXTURES['POST /products'];

export const PRICE_HISTORY_FIXTURES: Record<string, FixtureHandler> = {
  'GET /products/:id/history': (req) =>
    ok(history.filter((h) => h.productId === historyIdOf(req.url)).sort((a, b) => b.changedAt.localeCompare(a.changedAt))),
  'PUT /products/:id': (req) => {
    const before = getOne(req).body as Product | undefined;
    const res = put(req);
    if (res.status < 400) record(idOf(req.url), before, res.body as Product);
    return res;
  },
  'POST /products': (req) => {
    const res = post(req);
    if (res.status < 400) {
      const created = res.body as Product;
      record(created.id, undefined, created);
    }
    return res;
  },
};