import { Customer, PayMethod, Sale } from '../../pos/models/pos.models';

export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'cancelled' | 'expired';
export type OrderStatus = 'open' | 'partial' | 'delivered' | 'cancelled';
export type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'overdue';

export interface CustomerBrief {
  id: number;
  name: string;
  phone: string;
  type: string;
}

/** Wholesale customer (POS customer + credit fields). */
export interface WholesaleCustomer extends Customer {
  paymentTermsDays: number;
  address: string;
  city: string;
  /** Udhaar baqi. */
  balance: number;
}

export interface CustomerForm {
  name: string;
  phone: string;
  email: string;
  type: 'retail' | 'wholesale' | 'dealer';
  priceTier: string;
  creditLimit: number;
  paymentTermsDays: number;
  address: string;
  city: string;
  isActive: boolean;
}

export interface DocLine {
  id: number;
  productId: number;
  name: string;
  sku: string;
  serialized: boolean;
  qty: number;
  unitPrice: number;
  amount: number;
}

export interface OrderLine extends DocLine {
  deliveredQty: number;
}

export interface Quotation {
  id: number;
  number: string;
  customer: CustomerBrief;
  status: QuotationStatus;
  validUntil: string | null;
  total: number;
  note: string | null;
  createdBy: string;
  createdAt: string;
  orderId: number | null;
  lines: DocLine[];
}

export interface SalesOrder {
  id: number;
  number: string;
  customer: CustomerBrief;
  status: OrderStatus;
  quotationNumber: string | null;
  total: number;
  note: string | null;
  createdBy: string;
  createdAt: string;
  lines: OrderLine[];
  challans: { id: number; number: string; invoiced: boolean; createdAt: string }[];
}

export interface Challan {
  id: number;
  number: string;
  orderId: number;
  orderNumber: string;
  customer: CustomerBrief;
  warehouseId: number;
  warehouseName: string;
  invoiceId: number | null;
  invoiceNumber: string | null;
  note: string | null;
  createdBy: string;
  createdAt: string;
  lines: { id: number; orderLineId: number; productId: number; name: string; sku: string; serial: string | null; qty: number }[];
}

export interface Invoice extends Sale {
  challanNumber: string | null;
  dueDate: string | null;
  balance: number;
  returned: number;
  status: InvoiceStatus;
  paymentsDetail: { method: PayMethod; amount: number; reference: string | null; paidAt: string | null }[];
}

export interface PriceInfo {
  id: number;
  name: string;
  sku: string;
  serialized: boolean;
  tierPrice: number | null;
  /** Is user ke liye sab se kam price (null = koi price nahi). */
  lowestPrice: number | null;
  tier: string;
}

export interface DocLineInput {
  productId: number;
  qty: number;
  unitPrice: number | null;
}

export interface DocInput {
  customerId: number;
  lines: DocLineInput[];
  note: string | null;
  validUntil?: string | null;
}

export interface ChallanInput {
  orderId: number;
  warehouseId: number;
  lines: { orderLineId: number; serials?: string[]; qty?: number }[];
  note: string | null;
}

export interface PaymentInput {
  method: PayMethod;
  amount: number;
  reference?: string | null;
}
