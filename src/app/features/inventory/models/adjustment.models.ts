import { StockStatus } from './inventory.models';

export type AdjustmentKind = 'damage' | 'quarantine' | 'release';
export type AdjustmentStatus = 'pending' | 'approved' | 'rejected';
export type AdjustmentAction = 'approve' | 'reject';

export interface AdjustmentLine {
  serial: string;
  name: string;
  sku: string;
  from: StockStatus;
  to: StockStatus;
}

export interface StockAdjustment {
  id: number;
  number: string;
  kind: AdjustmentKind;
  status: AdjustmentStatus;
  lines: AdjustmentLine[];
  reason: string;
  decisionNote: string | null;
  createdBy: string;
  createdAt: string;
  decidedAt: string | null;
}

export interface AdjustmentInput {
  kind: AdjustmentKind;
  serials: string[];
  reason: string;
}