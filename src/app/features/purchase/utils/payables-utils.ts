import {
  LandedCostItem, LandedLine, LedgerEntry, MatchStatus, PoMatching,
} from '../models/payables.models';

export const round2 = (n: number): number => Math.round(n * 100) / 100;

export interface LedgerRow extends LedgerEntry {
  balance: number;
}

/** Tareekh ke hisaab se sort karke chalta hua balance lagata hai. */
export function ledgerWithBalance(entries: readonly LedgerEntry[]): LedgerRow[] {
  let balance = 0;
  return [...entries]
    .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
    .map((e) => {
      balance = round2(balance + e.increase - e.decrease);
      return { ...e, balance };
    });
}

/** Supplier ko abhi kitna dena baqi hai. */
export const outstanding = (entries: readonly LedgerEntry[]): number =>
  round2(entries.reduce((s, e) => s + e.increase - e.decrease, 0));

export type PaymentAmountError = 'invalid' | 'too_much';

export function paymentAmountError(amount: number, owed: number): PaymentAmountError | null {
  if (!Number.isFinite(amount) || amount <= 0) return 'invalid';
  return amount > owed + 0.005 ? 'too_much' : null;
}

export const landedTotal = (items: readonly LandedCostItem[]): number =>
  round2(items.reduce((s, i) => s + (i.amount || 0), 0));

/** Landed cost ko lines par maal ki value ke hisaab se baantta hai. Aakhri line ko baqi paisa milta hai. */
export function allocateLanded(
  lines: readonly { productId: number; name: string; qty: number; unitCost: number }[],
  items: readonly LandedCostItem[],
): LandedLine[] {
  const total = landedTotal(items);
  const values = lines.map((l) => round2(l.qty * l.unitCost));
  const base = values.reduce((s, v) => s + v, 0);
  const qtyBase = lines.reduce((s, l) => s + l.qty, 0);
  let given = 0;
  return lines.map((l, i) => {
    const last = i === lines.length - 1;
    const weight = base > 0 ? values[i] / base : qtyBase > 0 ? l.qty / qtyBase : 0;
    const share = last ? round2(total - given) : round2(total * weight);
    given = round2(given + share);
    return {
      productId: l.productId,
      name: l.name,
      qty: l.qty,
      goodsValue: values[i],
      landedShare: share,
      unitLanded: l.qty > 0 ? round2((values[i] + share) / l.qty) : 0,
    };
  });
}

export const receivedValue = (m: PoMatching): number =>
  round2(m.lines.reduce((s, l) => s + l.receivedQty * l.unitCost, 0));

export const orderedValue = (m: PoMatching): number =>
  round2(m.lines.reduce((s, l) => s + l.orderedQty * l.unitCost, 0));

/** PO, GRN aur supplier bill ka milaan. Bill ko jo maal asal mein aaya us ki value se milate hain. */
export function matchStatus(m: PoMatching): MatchStatus {
  if (m.lines.every((l) => l.receivedQty === 0)) return 'not_received';
  if (!m.bill) return 'no_bill';
  return Math.abs(m.bill.amount - receivedValue(m)) < 0.01 ? 'matched' : 'mismatch';
}