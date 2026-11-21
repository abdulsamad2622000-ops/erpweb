export type ReservationStatus = 'active' | 'released' | 'expired';

export interface ReservationLine {
  serial: string;
  name: string;
  sku: string;
}

export interface Reservation {
  id: number;
  number: string;
  customerName: string;
  note: string | null;
  /** Akhri tareekh (YYYY-MM-DD). null = jab tak release na ho. */
  holdUntil: string | null;
  status: ReservationStatus;
  lines: ReservationLine[];
  createdBy: string;
  createdAt: string;
  releasedAt: string | null;
}

export interface ReservationInput {
  customerName: string;
  note: string | null;
  holdUntil: string | null;
  serials: string[];
}