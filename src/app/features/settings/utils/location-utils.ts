import { LOCATION_LEVELS, LocationLevel, WarehouseLocation } from '../models/location.models';

/** Parent ke neeche agla level. null parent = zone. Bin ke neeche kuch nahi. */
export function nextLevel(parent: LocationLevel | null): LocationLevel | null {
  if (parent === null) return LOCATION_LEVELS[0];
  return LOCATION_LEVELS[LOCATION_LEVELS.indexOf(parent) + 1] ?? null;
}

export interface TreeRow {
  row: WarehouseLocation;
  depth: number;
  hasChildren: boolean;
}

/** Flat list ko tree ki tarteeb mein deta hai; collapsed ke bachay chhup jate hain. */
export function flattenTree(
  rows: readonly WarehouseLocation[],
  collapsed: ReadonlySet<number>,
): TreeRow[] {
  const byParent = new Map<number | null, WarehouseLocation[]>();
  for (const r of rows) {
    const list = byParent.get(r.parentId);
    if (list) list.push(r);
    else byParent.set(r.parentId, [r]);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }
  const out: TreeRow[] = [];
  const walk = (parentId: number | null, depth: number): void => {
    for (const row of byParent.get(parentId) ?? []) {
      out.push({ row, depth, hasChildren: (byParent.get(row.id) ?? []).length > 0 });
      if (!collapsed.has(row.id)) walk(row.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** Zone se le kar is location tak ki chain. */
export function pathOf(
  rows: readonly WarehouseLocation[],
  loc: WarehouseLocation,
): WarehouseLocation[] {
  const byId = new Map<number, WarehouseLocation>(rows.map((r) => [r.id, r] as [number, WarehouseLocation]));
  const out: WarehouseLocation[] = [];
  let cur: WarehouseLocation | undefined = loc;
  while (cur && out.length < 10) {
    out.unshift(cur);
    cur = cur.parentId === null ? undefined : byId.get(cur.parentId);
  }
  return out;
}

export function binBarcode(warehouseCode: string, pathCodes: readonly string[]): string {
  return ['BIN', warehouseCode, ...pathCodes].join('-').toUpperCase();
}