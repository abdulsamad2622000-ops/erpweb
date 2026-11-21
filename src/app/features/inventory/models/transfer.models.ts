export type TransferStatus = 'requested' | 'approved' | 'rejected' | 'in_transit' | 'received' | 'cancelled';
export type TransferAction = 'approve' | 'reject' | 'dispatch' | 'receive' | 'cancel';

export interface TransferLine {
  serial: string;
  name: string;
  sku: string;
}

export interface Transfer {
  id: number;
  number: string;
  fromWarehouseId: number;
  toWarehouseId: number;
  status: TransferStatus;
  lines: TransferLine[];
  note: string | null;
  /** Reject ki wajah. */
  reason: string | null;
  createdBy: string;
  createdAt: string;
  dispatchedAt: string | null;
  receivedAt: string | null;
  /** Receive par jo serials scan hue. */
  receivedSerials: string[];
}

export interface TransferInput {
  fromWarehouseId: number;
  toWarehouseId: number;
  serials: string[];
  note: string | null;
}