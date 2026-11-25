import { PayMethod } from '../../pos/models/pos.models';

export type WarrantyState = 'in_warranty' | 'expired' | 'not_ours';
export type JobStatus = 'received' | 'diagnosing' | 'waiting_parts' | 'repairing' | 'ready' | 'delivered' | 'cancelled';

export const JOB_STATUSES: JobStatus[] = ['received', 'diagnosing', 'waiting_parts', 'repairing', 'ready', 'delivered', 'cancelled'];

export interface WarrantyCheck {
  serial: string;
  productId: number | null;
  productName: string | null;
  sale: { id: number; number: string; date: string } | null;
  warrantyMonths: number;
  warrantyUntil: string | null;
  warranty: WarrantyState;
  customer: { id: number; name: string; phone: string } | null;
  /** Khuli job card ka number (ho to). */
  openJob: string | null;
}

export interface RepairPart {
  id?: number;
  description: string;
  qty: number;
  unitPrice: number;
  /** Stock se liya part (serial) — save par stock se nikal jata hai. */
  serial?: string | null;
}

export interface RepairJob {
  id: number;
  number: string;
  serial: string | null;
  productId: number | null;
  device: string;
  customerId: number | null;
  customerName: string;
  customerPhone: string;
  saleNumber: string | null;
  warranty: WarrantyState;
  warrantyUntil: string | null;
  problem: string;
  accessories: string;
  diagnosis: string | null;
  status: JobStatus;
  next: JobStatus[];
  estimate: number | null;
  labour: number;
  parts: RepairPart[];
  partsTotal: number;
  total: number;
  paid: number;
  paidMethod: PayMethod | null;
  promisedOn: string | null;
  deliveredAt: string | null;
  assignedTo: { id: number; name: string } | null;
  createdBy: string;
  createdAt: string;
  events: { status: JobStatus; note: string | null; at: string; by: string }[];
}

export interface JobInput {
  serial: string | null;
  device: string | null;
  customerId: number | null;
  customerName: string | null;
  customerPhone: string | null;
  problem: string;
  accessories: string;
  estimate: number | null;
  promisedOn: string | null;
}

export interface JobUpdate {
  diagnosis?: string | null;
  labour?: number;
  estimate?: number | null;
  promisedOn?: string | null;
  parts?: RepairPart[];
}
