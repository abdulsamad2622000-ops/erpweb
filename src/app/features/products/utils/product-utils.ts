import { ProductSpecs } from '../models';

/** Table ke liye chhota khulasa: CPU / RAM / Storage. */
export function specSummary(specs: Partial<ProductSpecs> | null | undefined): string {
  if (!specs) return '';
  return [specs.cpu, specs.ram, specs.storage]
    .map((s) => (s ?? '').trim())
    .filter((s) => s.length > 0)
    .join(' / ');
}