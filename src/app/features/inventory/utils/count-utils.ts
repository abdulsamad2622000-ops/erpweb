import { BadgeTone } from '../../../shared/ui/status-badge/status-badge.component';
import { CountAction, CountLine, CountStatus, StockCount } from '../models/count.models';

const ALLOWED: Record<CountStatus, CountAction[]> = {
  open: ['submit'],
  submitted: ['approve', 'reject'],
  approved: [],
  rejected: [],
};

export const canDoCount = (status: CountStatus, action: CountAction): boolean => ALLOWED[status].includes(action);

export const COUNT_TONE: Record<CountStatus, BadgeTone> = {
  open: 'info',
  submitted: 'warning',
  approved: 'success',
  rejected: 'danger',
};

export interface Variance {
  /** System mein hain, scan nahi hue. */
  missing: CountLine[];
  /** Scan hue, lekin system ke mutabiq is warehouse mein nahi the. */
  extra: CountLine[];
  matched: number;
}

export function variance(c: Pick<StockCount, 'expected' | 'counted'>): Variance {
  const exp = new Set(c.expected.map((l) => l.serial));
  const got = new Set(c.counted.map((l) => l.serial));
  return {
    missing: c.expected.filter((l) => !got.has(l.serial)),
    extra: c.counted.filter((l) => !exp.has(l.serial)),
    matched: c.counted.filter((l) => exp.has(l.serial)).length,
  };
}