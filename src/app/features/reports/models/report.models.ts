export type SalesGroup = 'day' | 'product' | 'staff' | 'channel';

export interface SalesRow {
  key: string;
  label: string;
  bills: number;
  qty: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
}

export interface SalesReport {
  from: string;
  to: string;
  groupBy: SalesGroup;
  rows: SalesRow[];
  totals: { bills: number; qty: number; revenue: number; cost: number; profit: number; margin: number; returns: number };
}

export interface StockRow {
  productId: number;
  name: string;
  sku: string;
  units: number;
  value: number;
  retailValue: number | null;
  oldestDays: number;
}

export interface StockReport {
  rows: StockRow[];
  totals: { units: number; value: number; retailValue: number };
  byStatus: Record<string, number>;
}

export interface PurchaseRow {
  supplierId: number;
  name: string;
  bills: number;
  billed: number;
  paid: number;
  payable: number;
}

export interface PurchaseReport {
  from: string;
  to: string;
  rows: PurchaseRow[];
  totals: { bills: number; billed: number; paid: number; payable: number };
}

export interface RepairReport {
  from: string;
  to: string;
  delivered: number;
  income: number;
  labour: number;
  parts: number;
  inWarranty: number;
  received: number;
  open: Record<string, number>;
  byTechnician: { name: string; jobs: number; income: number }[];
}

export interface Dashboard {
  todaySales: number;
  todayBills: number;
  monthSales: number;
  last14: { date: string; total: number }[];
  stockUnits: number;
  openRepairs: number;
  readyRepairs: number;
  openOrders: number;
  pendingPOs: number;
  canSeeMoney: boolean;
  monthProfit?: number;
  monthExpenses?: number;
  monthNet?: number;
  todayCash?: number;
  stockValue?: number;
  receivable?: number;
  overdue?: number;
  payable?: number;
  topProducts?: { name: string; qty: number; revenue: number }[];
}
