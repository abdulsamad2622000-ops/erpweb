export type PayMethod = 'cash' | 'card' | 'transfer';

export const PAY_METHODS: PayMethod[] = ['cash', 'card', 'transfer'];

/** Scan ya search se aaya item (serial = laptop, null = bina serial wala item). */
export interface PosItem {
  productId: number;
  serial: string | null;
  name: string;
  sku: string;
  specs: string | null;
  price: number | null;
  serialized: boolean;
  warrantyMonths: number;
}

export interface PosSearchResult extends PosItem {
  inStock: number;
  serials: string[];
}

export interface CartLine extends PosItem {
  qty: number;
}

export interface Payment {
  method: PayMethod;
  amount: number;
}

export interface PosShift {
  id: number;
  warehouseId: number;
  warehouseName: string;
  openingCash: number;
  openedAt: string;
  closedAt: string | null;
  salesCount: number;
  salesTotal: number;
  cashIn: number;
  cashRefunds: number;
  expectedCash: number;
  countedCash: number | null;
  note: string | null;
}

export interface ShiftState {
  shift: PosShift | null;
  /** null = koi limit nahi (super admin). */
  discountLimit: number | null;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string;
  type: 'retail' | 'wholesale' | 'dealer';
  priceTier: string;
  creditLimit: number;
  isActive: boolean;
}

export interface CustomerInput {
  name: string;
  phone: string;
  email?: string | null;
}

export interface SaleInput {
  customerId: number | null;
  lines: { productId: number; serial: string | null; qty: number }[];
  discount: number;
  payments: Payment[];
  note: string | null;
}

export interface SaleLine {
  id: number;
  productId: number;
  name: string;
  sku: string;
  serial: string | null;
  qty: number;
  unitPrice: number;
  warrantyMonths: number;
  returnedQty: number;
}

export interface Sale {
  id: number;
  number: string;
  channel: string;
  createdAt: string;
  cashier: string;
  warehouseName: string;
  customer: { id: number; name: string; phone: string } | null;
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  change: number;
  note: string | null;
  lines: SaleLine[];
  payments: Payment[];
  returns: { number: string; amount: number; refundMethod: PayMethod; createdAt: string }[];
}

export interface HeldBill {
  id: number;
  label: string;
  payload: { lines: CartLine[]; customer: Customer | null; discount: number };
  createdAt: string;
}

export interface ReturnInput {
  saleId: number;
  lines: { saleLineId: number; qty: number }[];
  refundMethod: PayMethod;
  reason: string;
}

export interface ReturnResult {
  id: number;
  number: string;
  amount: number;
  refundMethod: PayMethod;
  sale: Sale;
}
