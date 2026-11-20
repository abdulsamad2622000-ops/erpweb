export type StockStatus = 'in_stock' | 'quarantine' | 'rejected' | 'returned';

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
}

export type TimelineType = 'received' | 'returned';

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
  quarantine: number;
  rejected: number;
  returned: number;
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