import { Transfer, TransferAction, TransferStatus } from '../models/transfer.models';
import { BadgeTone } from '../../../shared/ui/status-badge/status-badge.component';

const ALLOWED: Record<TransferStatus, TransferAction[]> = {
  requested: ['approve', 'reject', 'cancel'],
  approved: ['dispatch', 'cancel'],
  in_transit: ['receive'],
  rejected: [],
  received: [],
  cancelled: [],
};

export const canDo = (status: TransferStatus, action: TransferAction): boolean => ALLOWED[status].includes(action);

/** Receive ho chuki transfer mein jo serials nahi pahunche. */
export function missingSerials(t: Pick<Transfer, 'lines' | 'receivedSerials' | 'status'>): string[] {
  if (t.status !== 'received') return [];
  return t.lines.map((l) => l.serial).filter((s) => !t.receivedSerials.includes(s));
}

export const TRANSFER_TONE: Record<TransferStatus, BadgeTone> = {
  requested: 'warning',
  approved: 'info',
  in_transit: 'info',
  received: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
};