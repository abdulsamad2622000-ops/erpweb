import {
  SerialDetail, StockLedgerRow, StockSerial, StockStatus, StockSummaryRow, TimelineEvent,
} from '../../../features/inventory/models/inventory.models';
import { InspectionStatus } from '../../../features/purchase/models/purchase.models';
import { FixtureHandler, fail, ok } from './fixture.types';
import { returns } from './payables.fixtures';
import { grns } from './purchase.fixtures';
import {
  adjustmentEvents, putawayEvents, reservationEvents, reservedRef, serialBin, serialWarehouse, statusOverride,
} from './stock-location';

const FROM_INSPECTION: Record<InspectionStatus, StockStatus> = {
  accepted: 'in_stock',
  quarantine: 'quarantine',
  rejected: 'rejected',
};

const query = (url: string): URLSearchParams => new URLSearchParams(url.split('?')[1] ?? '');
const lastSegment = (url: string): string => decodeURIComponent(url.split('?')[0].split('/').pop() ?? '');

function returnOf(serial: string) {
  return returns.find((r) => r.lines.some((l) => l.serial === serial));
}

/** Serial ka bin. Sirf tab jab serial abhi usi warehouse mein ho jahan bin hai (transfer ke baad bin khali). */
function binOf(serial: string, warehouseId: number): { binId: number | null; binCode: string | null } {
  const b = serialBin.get(serial);
  return b && b.warehouseId === warehouseId ? { binId: b.binId, binCode: b.code } : { binId: null, binCode: null };
}

/** Stock posted GRNs aur returns se banta hai, alag store nahi. */
export function allSerials(): StockSerial[] {
  const out: StockSerial[] = [];
  for (const g of grns) {
    if (g.status !== 'posted') continue;
    for (const l of g.lines) {
      for (const s of l.serials) {
        out.push({
          serial: s.serial,
          productId: l.productId,
          name: l.name,
          sku: l.sku,
          warehouseId: serialWarehouse.get(s.serial) ?? g.warehouseId,
          status: returnOf(s.serial) ? 'returned' : (statusOverride.get(s.serial) ?? FROM_INSPECTION[s.status]),
          grnNumber: g.number,
          supplierName: g.supplierName,
          receivedAt: g.postedAt ?? g.createdAt,
          reservedRef: reservedRef(s.serial),
          ...binOf(s.serial, serialWarehouse.get(s.serial) ?? g.warehouseId),
        });
      }
    }
  }
  return out;
}

function timelineOf(s: StockSerial): TimelineEvent[] {
  const events: TimelineEvent[] = [{ at: s.receivedAt, type: 'received', ref: s.grnNumber, note: null }];
  const r = returnOf(s.serial);
  if (r) events.push({ at: `${r.date}T00:00:00.000Z`, type: 'returned', ref: r.number, note: r.reason });
  events.push(...(adjustmentEvents.get(s.serial) ?? []));
  events.push(...(reservationEvents.get(s.serial) ?? []));
  events.push(...(putawayEvents.get(s.serial) ?? []));
  return events;
}

export const STOCK_FIXTURES: Record<string, FixtureHandler> = {
  'GET /inventory/stock': (req) => {
    const wh = Number(query(req.url).get('warehouseId') ?? 0);
    const map = new Map<string, StockSummaryRow>();
    for (const s of allSerials()) {
      if (s.warehouseId === 0 || (wh && s.warehouseId !== wh)) continue;
      const key = `${s.productId}-${s.warehouseId}`;
      const row = map.get(key) ?? {
        productId: s.productId, name: s.name, sku: s.sku, warehouseId: s.warehouseId,
        inStock: 0, reserved: 0, quarantine: 0, rejected: 0, returned: 0, damaged: 0,
      };
      if (s.status === 'in_stock') {
        row.inStock++;
        if (s.reservedRef) row.reserved = (row.reserved ?? 0) + 1;
      }
      else if (s.status === 'quarantine') row.quarantine++;
      else if (s.status === 'rejected') row.rejected++;
      else if (s.status === 'damaged') row.damaged++;
      else row.returned++;
      map.set(key, row);
    }
    return ok([...map.values()].sort((a, b) => a.name.localeCompare(b.name)));
  },

  'GET /inventory/serials': (req) => {
    const p = query(req.url);
    const q = (p.get('q') ?? '').trim().toLowerCase();
    const status = p.get('status') ?? '';
    return ok(
      allSerials().filter(
        (s) => (!status || s.status === status) && (!q || [s.serial, s.name, s.sku, s.grnNumber].some((v) => v.toLowerCase().includes(q))),
      ),
    );
  },

  'GET /inventory/serials/:id': (req) => {
    const code = lastSegment(req.url).trim().toUpperCase();
    const s = allSerials().find((x) => x.serial.toUpperCase() === code);
    if (!s) return fail(404, 'Serial not found.');
    const detail: SerialDetail = { ...s, timeline: timelineOf(s) };
    return ok(detail);
  },

  'GET /inventory/ledger': () => {
    const rows: StockLedgerRow[] = [];
    for (const s of allSerials()) {
      if (s.status === 'rejected') continue;
      rows.push({ id: `in-${s.serial}`, at: s.receivedAt, direction: 'in', serial: s.serial, productName: s.name, ref: s.grnNumber, warehouseId: s.warehouseId });
      const r = returnOf(s.serial);
      if (r) rows.push({ id: `out-${s.serial}`, at: `${r.date}T00:00:00.000Z`, direction: 'out', serial: s.serial, productName: s.name, ref: r.number, warehouseId: s.warehouseId });
    }
    return ok(rows.sort((a, b) => b.at.localeCompare(a.at) || b.id.localeCompare(a.id)));
  },
};