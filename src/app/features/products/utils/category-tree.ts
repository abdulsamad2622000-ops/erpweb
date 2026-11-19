import { Category } from '../models';

export interface CategoryRow {
  row: Category;
  depth: number;
  hasChildren: boolean;
}

function groupByParent(rows: readonly Category[]): Map<number | null, Category[]> {
  const ids = new Set(rows.map((r) => r.id));
  const byParent = new Map<number | null, Category[]>();
  for (const r of rows) {
    // Parent list mein na ho to top-level dikhao, taake category gayab na ho.
    const key = r.parentId != null && ids.has(r.parentId) ? r.parentId : null;
    const list = byParent.get(key);
    if (list) list.push(r);
    else byParent.set(key, [r]);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }
  return byParent;
}

/** Tree ki tarteeb mein flat list; collapsed ke bachay chhup jate hain. */
export function flattenCategories(
  rows: readonly Category[],
  collapsed: ReadonlySet<number>,
): CategoryRow[] {
  const byParent = groupByParent(rows);
  const out: CategoryRow[] = [];
  const walk = (parentId: number | null, depth: number): void => {
    for (const row of byParent.get(parentId) ?? []) {
      out.push({ row, depth, hasChildren: (byParent.get(row.id) ?? []).length > 0 });
      if (!collapsed.has(row.id)) walk(row.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** Is category ke neeche ke saare (bachay, pote...) ids. */
export function descendantIds(rows: readonly Category[], id: number): number[] {
  const byParent = groupByParent(rows);
  const out: number[] = [];
  const stack = [id];
  while (stack.length > 0 && out.length < 1000) {
    const cur = stack.pop() as number;
    for (const child of byParent.get(cur) ?? []) {
      out.push(child.id);
      stack.push(child.id);
    }
  }
  return out;
}