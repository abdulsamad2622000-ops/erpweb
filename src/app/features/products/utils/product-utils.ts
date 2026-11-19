import { PriceTierCode } from '../../settings/models/settings.models';
import { Product, ProductSpecs } from '../models';

/** Table ke liye chhota khulasa: CPU / RAM / Storage. */
export function specSummary(specs: Partial<ProductSpecs> | null | undefined): string {
  if (!specs) return '';
  return [specs.cpu, specs.ram, specs.storage]
    .map((s) => (s ?? '').trim())
    .filter((s) => s.length > 0)
    .join(' / ');
}

export function priceFor(p: Pick<Product, 'prices'>, tier: PriceTierCode): number | null {
  return p.prices?.find((x) => x.tier === tier)?.price ?? null;
}

export function retailPrice(p: Pick<Product, 'prices'>): number | null {
  return priceFor(p, 'retail');
}

export function formatMoney(n: number | null | undefined): string {
  return n === null || n === undefined
    ? '-'
    : new Intl.NumberFormat('en', { maximumFractionDigits: 2 }).format(n);
}

/** Wo tiers jin ki price minimum price (floor) se kam hai. */
export function floorViolations(
  minPrice: number | null,
  prices: Partial<Record<PriceTierCode, number | null>>,
): PriceTierCode[] {
  if (minPrice === null) return [];
  return (Object.keys(prices) as PriceTierCode[]).filter((t) => {
    const v = prices[t];
    return v !== null && v !== undefined && v < minPrice;
  });
}

/** Wo SKUs (chhote harf, trim) jo ek se zyada dafa aayi hain. */
export function duplicateSkus(skus: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const raw of skus) {
    const s = raw.trim().toLowerCase();
    if (!s) continue;
    if (seen.has(s)) dup.add(s);
    else seen.add(s);
  }
  return dup;
}