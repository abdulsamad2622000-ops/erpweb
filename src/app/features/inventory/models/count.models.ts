export type CountStatus = 'open' | 'submitted' | 'approved' | 'rejected';
export type CountAction = 'submit' | 'approve' | 'reject';

export interface CountLine {
  serial: string;
  name: string;
  sku: string;
}

export interface StockCount {
  id: number;
  number: string;
  warehouseId: number;
  status: CountStatus;
  /** Count shuru hote waqt system mein jitne in-stock serials the. */
  expected: CountLine[];
  /** Submit par jo serials scan hue. */
  counted: CountLine[];
  note: string | null;
  /** Reject ki wajah. */
  reason: string | null;
  createdBy: string;
  createdAt: string;
  submittedAt: string | null;
  decidedAt: string | null;
}

export interface CountInput {
  warehouseId: number;
  note: string | null;
}