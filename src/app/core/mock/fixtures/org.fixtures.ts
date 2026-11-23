import {
  Branch,
  WAREHOUSE_TYPES,
  Warehouse,
} from '../../../features/settings/models/org.models';
import { FixtureHandler, fail, ok } from './fixture.types';
import { LocationInput, WarehouseLocation } from '../../../features/settings/models/location.models';
import { binBarcode, nextLevel, pathOf } from '../../../features/settings/utils/location-utils';
import { crud, paged } from './products.fixtures';

const branches: Branch[] = [
  { id: 1, code: 'LHR', name: 'Main Branch', city: 'Lahore', address: 'Shop 12, Main Boulevard', phone: '+92 42 111 000 111', isActive: true },
  { id: 2, code: 'KHI', name: 'Karachi Branch', city: 'Karachi', address: 'Block 5, Clifton', phone: '+92 21 111 000 222', isActive: true },
  { id: 3, code: 'ISB', name: 'Islamabad Branch', city: 'Islamabad', address: 'F-7 Markaz', phone: '+92 51 111 000 333', isActive: true },
];

export const warehouses: Warehouse[] = [
  { id: 1, branchId: 1, code: 'LHR-SELL', name: 'Lahore Main Store', type: 'sellable', isActive: true },
  { id: 2, branchId: 1, code: 'LHR-SHOW', name: 'Lahore Showroom', type: 'showroom', isActive: true },
  { id: 3, branchId: 1, code: 'LHR-DMG', name: 'Lahore Damaged', type: 'damaged', isActive: true },
  { id: 4, branchId: 2, code: 'KHI-SELL', name: 'Karachi Main Store', type: 'sellable', isActive: true },
  { id: 5, branchId: 2, code: 'KHI-REP', name: 'Karachi Repair', type: 'repair', isActive: true },
  { id: 6, branchId: 3, code: 'ISB-SELL', name: 'Islamabad Main Store', type: 'sellable', isActive: true },
];

export const locations: WarehouseLocation[] = [
  { id: 1, warehouseId: 1, parentId: null, level: 'zone', code: 'A', name: 'Zone A', barcode: null, isActive: true },
  { id: 2, warehouseId: 1, parentId: 1, level: 'rack', code: 'R1', name: 'Rack 1', barcode: null, isActive: true },
  { id: 3, warehouseId: 1, parentId: 2, level: 'shelf', code: 'S1', name: 'Shelf 1', barcode: null, isActive: true },
  { id: 4, warehouseId: 1, parentId: 3, level: 'bin', code: 'B01', name: 'Bin 01', barcode: 'BIN-LHR-SELL-A-R1-S1-B01', isActive: true },
  { id: 5, warehouseId: 1, parentId: 3, level: 'bin', code: 'B02', name: 'Bin 02', barcode: 'BIN-LHR-SELL-A-R1-S1-B02', isActive: true },
  { id: 6, warehouseId: 1, parentId: null, level: 'zone', code: 'B', name: 'Zone B', barcode: null, isActive: true },
];

const locIdOf = (url: string): number => Number(url.split('?')[0].split('/').pop());

function locationError(b: LocationInput, ignoreId: number): string | null {
  const code = (b.code ?? '').trim().toLowerCase();
  const name = (b.name ?? '').trim();
  if (!code || !name) return 'Code and name are required.';
  if (!warehouses.some((w) => w.id === b.warehouseId)) return 'Choose a warehouse.';
  const parent = b.parentId === null ? null : locations.find((l) => l.id === b.parentId);
  if (b.parentId !== null && !parent) return 'Parent location not found.';
  if (parent && parent.warehouseId !== b.warehouseId) return 'Parent is in another warehouse.';
  if (b.level !== nextLevel(parent?.level ?? null)) return 'Wrong level for this parent.';
  const clash = locations.some(
    (l) =>
      l.id !== ignoreId &&
      l.warehouseId === b.warehouseId &&
      l.parentId === b.parentId &&
      l.code.toLowerCase() === code,
  );
  return clash ? 'This code already exists here.' : null;
}

const locationHandlers: Record<string, FixtureHandler> = {
  'GET /locations': (req) => {
    const wh = Number(new URL(req.url, 'http://mock').searchParams.get('warehouseId') ?? 0);
    const rows = wh ? locations.filter((l) => l.warehouseId === wh) : locations;
    return ok(paged(rows, req.url, (l) => `${l.code} ${l.name} ${l.barcode ?? ''}`));
  },
  'POST /locations': (req) => {
    const b = req.body as LocationInput;
    const err = locationError(b, 0);
    if (err) return fail(422, err);
    const row: WarehouseLocation = {
      ...b,
      id: Math.max(0, ...locations.map((l) => l.id)) + 1,
      code: b.code.trim().toUpperCase(),
      name: b.name.trim(),
      barcode: null,
    };
    locations.push(row);
    const wh = warehouses.find((w) => w.id === row.warehouseId);
    if (row.level === 'bin' && wh) {
      row.barcode = binBarcode(wh.code, pathOf(locations, row).map((p) => p.code));
    }
    return ok(row);
  },
  'PUT /locations/:id': (req) => {
    const id = locIdOf(req.url);
    const row = locations.find((l) => l.id === id);
    if (!row) return fail(404, 'Not found.');
    const b = req.body as LocationInput;
    const merged: LocationInput = {
      warehouseId: row.warehouseId,
      parentId: row.parentId,
      level: row.level,
      code: b.code,
      name: b.name,
      isActive: b.isActive,
    };
    const err = locationError(merged, id);
    if (err) return fail(422, err);
    // Barcode nahi badalta: chhapa hua label purana na pade.
    row.code = merged.code.trim().toUpperCase();
    row.name = merged.name.trim();
    row.isActive = merged.isActive;
    return ok(row);
  },
  'DELETE /locations/:id': (req) => {
    const id = locIdOf(req.url);
    const i = locations.findIndex((l) => l.id === id);
    if (i < 0) return fail(404, 'Not found.');
    if (locations.some((l) => l.parentId === id)) {
      return fail(409, 'This location has child locations and cannot be deleted.');
    }
    locations.splice(i, 1);
    return ok();
  },
};

export const ORG_FIXTURES: Record<string, FixtureHandler> = {
  ...locationHandlers,
  ...crud('branches', branches, (b) => `${b.code} ${b.name} ${b.city}`, {
    inUse: (id) => warehouses.some((w) => w.branchId === id),
    duplicate: (b, ignoreId) => {
      const code = (b.code ?? '').trim().toLowerCase();
      const name = (b.name ?? '').trim().toLowerCase();
      if (!code || !name) return 'Code and name are required.';
      if (branches.some((r) => r.id !== ignoreId && r.code.toLowerCase() === code)) {
        return 'This code already exists.';
      }
      if (branches.some((r) => r.id !== ignoreId && r.name.toLowerCase() === name)) {
        return 'This name already exists.';
      }
      return null;
    },
  }),
  ...crud('warehouses', warehouses, (w) => `${w.code} ${w.name}`, {
    inUse: (id) => locations.some((l) => l.warehouseId === id),
    duplicate: (b, ignoreId) => {
      const code = (b.code ?? '').trim().toLowerCase();
      const name = (b.name ?? '').trim().toLowerCase();
      if (!branches.some((r) => r.id === b.branchId)) return 'Choose a branch.';
      if (!(WAREHOUSE_TYPES as readonly string[]).includes(b.type)) return 'Choose a warehouse type.';
      if (!code || !name) return 'Code and name are required.';
      if (warehouses.some((r) => r.id !== ignoreId && r.code.toLowerCase() === code)) {
        return 'This code already exists.';
      }
      if (warehouses.some((r) => r.id !== ignoreId && r.branchId === b.branchId && r.name.toLowerCase() === name)) {
        return 'This name already exists.';
      }
      return null;
    },
  }),
};