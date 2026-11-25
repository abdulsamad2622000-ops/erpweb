import { BadgeTone } from '../../../shared/ui/status-badge/status-badge.component';
import { StockStatus } from '../models/inventory.models';

export const STOCK_TONE: Record<StockStatus, BadgeTone> = {
  in_stock: 'success',
  quarantine: 'warning',
  rejected: 'danger',
  returned: 'neutral',
  damaged: 'danger',
  sold: 'info',
  consumed: 'neutral',
};

export const STOCK_STATUSES: StockStatus[] = ['in_stock', 'quarantine', 'rejected', 'returned', 'damaged', 'sold', 'consumed'];