export type PaymentMethod = 'cash' | 'bank_transfer' | 'cheque';
export type LedgerEntryType = 'opening' | 'grn' | 'return' | 'payment';

/** increase = supplier ka paisa hum par barha (GRN). decrease = kam hua (payment, return). */
export interface LedgerEntry {
  id: string;
  date: string;
  type: LedgerEntryType;
  ref: string;
  increase: number;
  decrease: number;
}

export interface SupplierLedger {
  supplierId: number;
  entries: LedgerEntry[];
}

export interface SupplierPayment {
  id: number;
  supplierId: number;
  date: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  note: string | null;
  createdBy: string;
}

export interface PaymentInput {
  supplierId: number;
  date: string;
  amount: number;
  method: PaymentMethod;
  reference: string;
  note: string | null;
}

export interface LandedCostItem {
  label: string;
  amount: number;
}

export interface LandedCost {
  grnId: number;
  items: LandedCostItem[];
}

export interface LandedLine {
  productId: number;
  name: string;
  qty: number;
  goodsValue: number;
  landedShare: number;
  unitLanded: number;
}

export interface ReturnableSerial {
  serial: string;
  productId: number;
  name: string;
  sku: string;
  supplierId: number;
  supplierName: string;
  grnNumber: string;
  unitCost: number;
}

export interface PurchaseReturnLine {
  serial: string;
  name: string;
  unitCost: number;
}

export interface PurchaseReturn {
  id: number;
  number: string;
  supplierId: number;
  supplierName: string;
  date: string;
  lines: PurchaseReturnLine[];
  total: number;
  reason: string;
  createdBy: string;
}

export interface PurchaseReturnInput {
  supplierId: number;
  serials: string[];
  reason: string;
}

export interface SupplierBill {
  poId: number;
  number: string;
  billDate: string;
  amount: number;
}

export interface BillInput {
  number: string;
  billDate: string;
  amount: number;
}

export interface MatchLine {
  productId: number;
  name: string;
  orderedQty: number;
  receivedQty: number;
  unitCost: number;
}

export interface PoMatching {
  poId: number;
  poNumber: string;
  lines: MatchLine[];
  grnNumbers: string[];
  bill: SupplierBill | null;
}

export type MatchStatus = 'matched' | 'mismatch' | 'no_bill' | 'not_received';