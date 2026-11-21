import type { PutAwayBody } from '../../../features/scan/models/putaway.models';
import { FixtureHandler, fail, ok } from './fixture.types';
import { locations } from './org.fixtures';
import { serialBin } from './stock-location';
import { allSerials } from './stock.fixtures';

/** Put-away: serial ko bin mein rakhta hai. Idempotency-Key header mock mein ignore hota hai. */
export const PUTAWAY_FIXTURES: Record<string, FixtureHandler> = {
  'POST /inventory/putaway': (req) => {
    const b = (req.body ?? {}) as Partial<PutAwayBody>;
    const barcode = (b.bin ?? '').trim().toUpperCase();
    const bin = locations.find(
      (l) => l.level === 'bin' && l.isActive && (l.barcode ?? '').toUpperCase() === barcode,
    );
    if (!bin) return fail(404, 'Bin not found.');

    const code = (b.serial ?? '').trim().toUpperCase();
    const s = allSerials().find((x) => x.serial.toUpperCase() === code);
    if (!s) return fail(404, 'Serial not found.');

    if (s.status !== 'in_stock') {
      return { status: 422, body: { message: 'Only in-stock items can be put away.', code: 'not_in_stock' } };
    }
    if (s.warehouseId !== bin.warehouseId) {
      return { status: 422, body: { message: 'Item and bin are in different warehouses.', code: 'wrong_warehouse' } };
    }

    const binBarcode = bin.barcode ?? '';
    const previousBin = serialBin.get(s.serial) ?? null;
    serialBin.set(s.serial, binBarcode);
    return ok({ serial: s.serial, binBarcode, binName: bin.name, warehouseId: bin.warehouseId, previousBin });
  },
};