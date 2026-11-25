import { PutAwayRow } from '../models/putaway.models';

export const BIN_PREFIX = 'BIN-';

/** Bin ke label ka barcode BIN- se shuru hota hai (settings ke bin labels). */
export function isBinCode(code: string): boolean {
  return code.trim().toUpperCase().startsWith(BIN_PREFIX);
}

/** Server ke error se translation key. */
export function putAwayErrorKey(e: unknown): string {
  const err = e as {
    status?: number;
    error?: { code?: string; message?: string; errors?: Record<string, string[] | undefined> };
  } | null;
  switch (err?.error?.code) {
    case 'not_in_stock':
      return 'scanApp.putaway.errors.notInStock';
    case 'wrong_warehouse':
      return 'scanApp.putaway.errors.wrongWarehouse';
  }
  // Asli server 422 par message likhta hai, jaise "Serial X is in another warehouse than this bin."
  const text = (err?.error?.errors?.['serials']?.[0] ?? err?.error?.message ?? '').toLowerCase();
  if (text.includes('another warehouse')) return 'scanApp.putaway.errors.wrongWarehouse';
  if (text.includes('already in this bin')) return 'scanApp.putaway.duplicate';
  if (text.includes('in transit') || text.includes('not in the warehouse')) return 'scanApp.putaway.errors.notInStock';
  if (text.includes('not known')) return 'scanApp.putaway.errors.serialNotFound';
  return err?.status === 404 ? 'scanApp.putaway.errors.serialNotFound' : 'errors.generic';
}

/** Ye serial is bin mein is session mein pehle hi rakha ja chuka hai? */
export function isPlacedHere(rows: readonly PutAwayRow[], serial: string, binBarcode: string): boolean {
  const s = serial.trim().toUpperCase();
  return rows.some((r) => r.status !== 'failed' && r.binBarcode === binBarcode && r.serial.toUpperCase() === s);
}