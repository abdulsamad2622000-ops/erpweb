import { round2 } from '../../pos/utils/pos-utils';
import { CashEntry, ExpenseInput } from '../models/accounts.models';

/** Form ki ghalti (i18n key) ya null. */
export function expenseProblem(e: Partial<ExpenseInput>, today = new Date().toISOString().slice(0, 10)): string | null {
  if (!e.date) return 'expensesPage.errors.date';
  if (e.date > today) return 'expensesPage.errors.future';
  if (!e.categoryId) return 'expensesPage.errors.category';
  if (!(Number(e.amount) >= 1)) return 'expensesPage.errors.amount';
  return null;
}

/** Opening se running balance dobara (frontend filter ke baad). */
export function runningBalance(opening: number, rows: Omit<CashEntry, 'balance'>[]): CashEntry[] {
  let b = opening;
  return rows.map((r) => {
    b = round2(b + r.in - r.out);
    return { ...r, balance: b };
  });
}
