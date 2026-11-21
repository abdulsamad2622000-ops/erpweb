export interface PutAwayBody {
  /** Bin ka barcode. */
  bin: string;
  serial: string;
}

export interface PutAwayResult {
  serial: string;
  binBarcode: string;
  binName: string;
  warehouseId: number;
  previousBin: string | null;
}

export type PutAwayRowStatus = 'placed' | 'queued' | 'failed';

/** Is session mein har scan ki ek row. */
export interface PutAwayRow {
  id: number;
  serial: string;
  binBarcode: string;
  status: PutAwayRowStatus;
  message: string;
}