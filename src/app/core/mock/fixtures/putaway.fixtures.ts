import { PutawayInput } from '../../../features/inventory/models/putaway.models';
import { normalizeSerial } from '../../../features/purchase/utils/purchase-utils';
import { FixtureHandler, FixtureResponse, fail, ok } from './fixture.types';
import { locations } from './org.fixtures';
import { putawayEvents, serialBin } from './stock-location';
import { allSerials } from './stock.fixtures';

const MAX_SERIALS = 100;

function putaway(req: { body: unknown }): FixtureResponse {
  const b = req.body as PutawayInput;
  const code = normalizeSerial(b?.binBarcode ?? '');
  const bin = locations.find((l) => l.level === 'bin' && l.isActive && (l.barcode ?? '').toUpperCase() === code);
  if (!bin) return fail(422, 'Bin not found.');

  const wanted = [...new Set((b.serials ?? []).map(normalizeSerial))].filter(Boolean);
  if (!wanted.length) return fail(422, 'Add at least one serial.');
  if (wanted.length > MAX_SERIALS) return fail(422, `Too many serials (${MAX_SERIALS} max).`);

  const stock = allSerials();
  for (const serial of wanted) {
    const s = stock.find((x) => x.serial === serial);
    if (!s) return fail(422, `Serial ${serial} is not known.`);
    if (s.warehouseId === 0) return fail(422, `Serial ${serial} is in transit.`);
    if (s.warehouseId !== bin.warehouseId) return fail(422, `Serial ${serial} is in another warehouse than this bin.`);
    if (s.status === 'returned') return fail(422, `Serial ${serial} is not in the warehouse.`);
    if (s.binId === bin.id) return fail(422, `Serial ${serial} is already in this bin.`);
  }

  const at = new Date().toISOString();
  const ref = bin.barcode ?? bin.code;
  for (const serial of wanted) {
    serialBin.set(serial, { binId: bin.id, warehouseId: bin.warehouseId, code: ref });
    putawayEvents.set(serial, [...(putawayEvents.get(serial) ?? []), { at, type: 'putaway', ref, note: null }]);
  }
  return ok({ moved: wanted.length, bin: ref });
}

export const PUTAWAY_FIXTURES: Record<string, FixtureHandler> = {
  'POST /inventory/putaway': putaway,
};