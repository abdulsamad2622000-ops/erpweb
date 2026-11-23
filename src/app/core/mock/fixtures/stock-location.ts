import { StockStatus, TimelineEvent } from '../../../features/inventory/models/inventory.models';
import { todayIso } from '../../../features/inventory/utils/reservation-utils';

/** Transfers se badli hui warehouse. Serial -> warehouse id. 0 = raaste mein (in transit). */
export const serialWarehouse = new Map<string, number>();

/** Adjustments se badli hui status. Serial -> nayi status. */
export const statusOverride = new Map<string, StockStatus>();

/** Adjustments ki history entries. Serial -> events. */
export const adjustmentEvents = new Map<string, TimelineEvent[]>();

/** Reservations ki history entries (reserved aur released). Serial -> events. */
export const reservationEvents = new Map<string, TimelineEvent[]>();

/** Put-away ki history entries. Serial -> events. */
export const putawayEvents = new Map<string, TimelineEvent[]>();

export interface BinSlot {
  binId: number;
  warehouseId: number;
  code: string;
}

/** Put-away se mila bin. Serial -> bin. */
export const serialBin = new Map<string, BinSlot>();

export interface Hold {
  ref: string;
  holdUntil: string | null;
}

/** Reservations se roke hue serials. Serial -> hold. */
export const holds = new Map<string, Hold>();

/** Serial kis reservation mein roka hai. Hold ki tareekh guzar gayi ho to null. */
export function reservedRef(serial: string, today: string = todayIso()): string | null {
  const h = holds.get(serial);
  if (!h) return null;
  return h.holdUntil !== null && h.holdUntil < today ? null : h.ref;
}