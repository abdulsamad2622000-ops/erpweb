import { StockSerial } from '../models/inventory.models';

type Binned = Pick<StockSerial, 'binId'>;

/** Har bin mein kitne serials hain. Bin ke baghair walon ko nahi ginta. */
export function binCounts(serials: readonly Binned[]): Map<number, number> {
  const out = new Map<number, number>();
  for (const s of serials) {
    if (!s.binId) continue;
    out.set(s.binId, (out.get(s.binId) ?? 0) + 1);
  }
  return out;
}

/** Ek bin ke serials. binId 0 = jin ka abhi bin nahi hai. */
export function serialsInBin<T extends Binned>(serials: readonly T[], binId: number): T[] {
  return serials.filter((s) => (binId === 0 ? !s.binId : s.binId === binId));
}