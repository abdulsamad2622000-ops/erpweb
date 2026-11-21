export type StockStatus = 'in_stock' | 'quarantine' | 'rejected' | 'returned' | 'damaged';

export interface StockSerial {
  serial: string;
  productId: number;
  name: string;
  sku: string;
  warehouseId: number;
  status: StockStatus;
  grnNumber: string;
  supplierName: string;
  receivedAt: string;
  /** Kis reservation mein roka hua hai (nahi to null). */
  reservedRef?: string | null;
}

export type TimelineType = 'received' | 'returned' | 'adjusted' | 'reserved' | 'released';

export interface TimelineEvent {
  at: string;
  type: TimelineType;
  ref: string;
  note: string | null;
}

export interface SerialDetail extends StockSerial {
  timeline: TimelineEvent[];
}

export interface StockSummaryRow {
  productId: number;
  name: string;
  sku: string;
  warehouseId: number;
  inStock: number;
  /** In-stock mein se kitne reserved hain. Available = inStock - reserved. */
  reserved?: number;
  quarantine: number;
  rejected: number;
  returned: number;
  damaged: number;
}

export interface StockLedgerRow {
  id: string;
  at: string;
  direction: 'in' | 'out';
  serial: string;
  productName: string;
  ref: string;
  warehouseId: number;
}