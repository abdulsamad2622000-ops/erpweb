import { BadgeTone } from '../../../shared/ui/status-badge/status-badge.component';
import { AdjustmentAction, AdjustmentKind, AdjustmentStatus } from '../models/adjustment.models';
import { StockStatus } from '../models/inventory.models';

export const MIN_REASON = 10;
export const ADJUSTMENT_KINDS: AdjustmentKind[] = ['quarantine', 'release', 'damage'];

/** Adjustment ke baad serial ki nayi status. */
export const ADJUSTMENT_TARGET: Record<AdjustmentKind, StockStatus> = {
  damage: 'damaged',
  quarantine: 'quarantine',
  release: 'in_stock',
};

const FROM: Record<AdjustmentKind, StockStatus[]> = {
  damage: ['in_stock', 'quarantine'],
  quarantine: ['in_stock'],
  release: ['quarantine'],
};

export const canAdjust = (from: StockStatus, kind: AdjustmentKind): boolean => FROM[kind].includes(from);

const ALLOWED: Record<AdjustmentStatus, AdjustmentAction[]> = {
  pending: ['approve', 'reject'],
  approved: [],
  rejected: [],
};

export const canDoAdjustment = (status: AdjustmentStatus, action: AdjustmentAction): boolean =>
  ALLOWED[status].includes(action);

export const ADJUSTMENT_TONE: Record<AdjustmentStatus, BadgeTone> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
};