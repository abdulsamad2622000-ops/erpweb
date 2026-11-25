import { PayMethod } from '../../pos/models/pos.models';

export interface ExpenseCategory {
  id: number;
  name: string;
  isActive: boolean;
}

export interface Expense {
  id: number;
  number: string;
  date: string;
  categoryId: number;
  category: string;
  branchId: number | null;
  amount: number;
  method: PayMethod;
  paidTo: string;
  reference: string | null;
  note: string | null;
  voided: boolean;
  voidReason: string | null;
  createdBy: string;
  createdAt: string;
}

export interface ExpenseInput {
  date: string;
  categoryId: number;
  branchId: number | null;
  amount: number;
  method: PayMethod;
  paidTo: string;
  reference: string | null;
  note: string | null;
}

export type CashType = 'sale' | 'receipt' | 'change' | 'refund' | 'repair' | 'supplier' | 'expense';

export interface CashEntry {
  at: string;
  type: CashType;
  ref: string;
  method: PayMethod;
  in: number;
  out: number;
  balance: number;
  note: string | null;
}

export interface CashBook {
  from: string;
  to: string;
  method: PayMethod | 'all';
  opening: number;
  totalIn: number;
  totalOut: number;
  closing: number;
  entries: CashEntry[];
}

export interface ProfitReport {
  from: string;
  to: string;
  salesRevenue: number;
  costOfGoods: number;
  salesProfit: number;
  repairIncome: number;
  repairPartsCost: number;
  grossProfit: number;
  expenses: number;
  expensesByCategory: { category: string; amount: number }[];
  netProfit: number;
}
