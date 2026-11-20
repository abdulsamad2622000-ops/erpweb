import { BadgeTone } from '../../../shared/ui/status-badge/status-badge.component';
import { InspectionStatus, PoStatus } from '../models/purchase.models';

/** Purchase screens ki common Tailwind classes. */
export const UI = {
  input: 'min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm',
  btn: 'inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-400 px-4 text-sm disabled:opacity-50',
  primary: 'inline-flex min-h-11 items-center justify-center rounded-lg bg-[#1E3A8A] px-5 text-sm text-white disabled:opacity-50',
  danger: 'inline-flex min-h-11 items-center justify-center rounded-lg border border-red-600 px-4 text-sm text-red-600 disabled:opacity-50',
  card: 'rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900',
  tableWrap: 'overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900',
  th: 'px-4 py-3 text-start font-medium',
  td: 'px-4 py-2',
  tr: 'border-b border-slate-100 last:border-0 dark:border-slate-800',
  thead: 'border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400',
} as const;

export const PO_TONE: Record<PoStatus, BadgeTone> = {
  draft: 'neutral', pending_approval: 'warning', approved: 'info', rejected: 'danger',
  partially_received: 'warning', received: 'success', cancelled: 'neutral',
};

export const INSPECTION_TONE: Record<InspectionStatus, BadgeTone> = {
  accepted: 'success', rejected: 'danger', quarantine: 'warning',
};

export const errorMessage = (e: unknown, fallback: string): string =>
  (e as { error?: { message?: string } })?.error?.message ?? fallback;
