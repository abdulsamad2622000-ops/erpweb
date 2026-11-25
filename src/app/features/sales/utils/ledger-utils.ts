import { round2 } from '../../pos/utils/pos-utils';
import { OpenInvoice } from '../models/sales.models';

/** FIFO: raqam purani invoices par baantna (backend jaisa). */
export function fifoAllocate(open: OpenInvoice[], amount: number): { invoiceId: number; amount: number }[] {
  let left = round2(amount);
  const out: { invoiceId: number; amount: number }[] = [];
  for (const inv of [...open].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id)) {
    if (left <= 0.004) break;
    const take = round2(Math.min(left, inv.balance));
    out.push({ invoiceId: inv.id, amount: take });
    left = round2(left - take);
  }
  return out;
}

/** Manual allocation ki ghalti (i18n key) ya null. */
export function allocationProblem(open: OpenInvoice[], amount: number, alloc: Record<number, number>): string | null {
  const due = round2(open.reduce((a, i) => a + i.balance, 0));
  if (!(amount > 0)) return 'ledgerPage.errors.amount';
  if (amount > due + 0.001) return 'ledgerPage.errors.overDue';
  const entries = Object.entries(alloc).filter(([, v]) => v > 0);
  if (!entries.length) return null; // FIFO
  for (const [id, v] of entries) {
    const inv = open.find((i) => i.id === Number(id));
    if (!inv || v > inv.balance + 0.001) return 'ledgerPage.errors.overInvoice';
  }
  if (Math.abs(round2(entries.reduce((a, [, v]) => a + v, 0)) - amount) > 0.001) return 'ledgerPage.errors.notMatching';
  return null;
}

/** Din kitne late (due date guzre). */
export function daysLate(dueDate: string | null, today = new Date().toISOString().slice(0, 10)): number {
  if (!dueDate || dueDate >= today) return 0;
  return Math.round((Date.parse(today) - Date.parse(dueDate)) / 86400000);
}
