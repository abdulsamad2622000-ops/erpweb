import { Category } from '../models';

/** Har category ka poora raasta, jaise "Laptops › Business Laptops". */
export function categoryPaths(rows: readonly Category[]): Map<number, string> {
  const byId = new Map<number, Category>(rows.map((r) => [r.id, r] as [number, Category]));
  const out = new Map<number, string>();
  for (const row of rows) {
    const names: string[] = [];
    let cur: Category | undefined = row;
    while (cur && names.length < 10) {
      names.unshift(cur.name);
      cur = cur.parentId == null ? undefined : byId.get(cur.parentId);
    }
    out.set(row.id, names.join(' \u203A '));
  }
  return out;
}