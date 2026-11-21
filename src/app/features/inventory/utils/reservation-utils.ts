import { BadgeTone } from '../../../shared/ui/status-badge/status-badge.component';
import { Reservation, ReservationStatus } from '../models/reservation.models';

export const MAX_RESERVATION_SERIALS = 100;

export const RESERVATION_TONE: Record<ReservationStatus, BadgeTone> = {
  active: 'info',
  released: 'neutral',
  expired: 'warning',
};

/** Aaj ki tareekh YYYY-MM-DD (UTC). */
export const todayIso = (now: Date = new Date()): string => now.toISOString().slice(0, 10);

/** Akhri tareekh tak serial roka rehta hai, us ke agle din se expired. */
export function effectiveStatus(
  r: Pick<Reservation, 'status' | 'holdUntil'>,
  today: string = todayIso(),
): ReservationStatus {
  if (r.status === 'released') return 'released';
  return r.holdUntil !== null && r.holdUntil < today ? 'expired' : 'active';
}

export const isHolding = (r: Pick<Reservation, 'status' | 'holdUntil'>, today: string = todayIso()): boolean =>
  effectiveStatus(r, today) === 'active';

export const isValidDate = (v: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));