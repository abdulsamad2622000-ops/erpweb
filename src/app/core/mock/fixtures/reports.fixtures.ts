import { SalesGroup, SalesRow } from '../../../features/reports/models/report.models';
import { round2 } from '../../../features/pos/utils/pos-utils';
import { FixtureHandler, ok } from './fixture.types';
import { sales } from './pos.fixtures';
import { products } from './products.fixtures';
import { jobs } from './repairs.fixtures';
import { allSerials } from './stock.fixtures';

const qp = (url: string, k: string): string => new URL(url, 'http://x').searchParams.get(k) ?? '';
const today = (): string => new Date().toISOString().slice(0, 10);
const monthStart = (): string => `${today().slice(0, 8)}01`;
const inRange = (iso: string, from: string, to: string): boolean => iso.slice(0, 10) >= from && iso.slice(0, 10) <= to;

/** Mock mein cost = product ki cost price (serial cost mock mein nahi). */
function lines(from: string, to: string) {
  return sales.filter((s) => inRange(s.createdAt, from, to)).flatMap((s) => s.lines.map((l) => {
    const ratio = s.subtotal > 0 ? s.total / s.subtotal : 1;
    const qty = l.qty - l.returnedQty;
    const cost = (products.find((p) => p.id === l.productId) as { costPrice?: number | null } | undefined)?.costPrice ?? 0;
    return { sale: s, l, qty, revenue: round2(qty * l.unitPrice * ratio), cost: round2(qty * cost) };
  }));
}

export const REPORT_FIXTURES: Record<string, FixtureHandler> = {
  'GET /dashboard': () => {
    const t = today();
    const ls = lines(monthStart(), t);
    const last14 = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(Date.now() - (13 - i) * 86400000).toISOString().slice(0, 10);
      return { date: d, total: round2(sales.filter((s) => s.createdAt.slice(0, 10) === d).reduce((a, s) => a + s.total, 0)) };
    });
    return ok({
      todaySales: last14[13].total, todayBills: sales.filter((s) => s.createdAt.slice(0, 10) === t).length,
      monthSales: round2(sales.filter((s) => s.createdAt.slice(0, 10) >= monthStart()).reduce((a, s) => a + s.total, 0)), last14,
      stockUnits: allSerials().filter((s) => s.status === 'in_stock').length,
      openRepairs: jobs.filter((j) => !['delivered', 'cancelled'].includes(j.status)).length,
      readyRepairs: jobs.filter((j) => j.status === 'ready').length, openOrders: 0, pendingPOs: 0, canSeeMoney: true,
      monthProfit: round2(ls.reduce((a, x) => a + x.revenue - x.cost, 0)), stockValue: 0,
      receivable: round2(sales.reduce((a, s) => a + Math.max(s.total - s.paid + s.change, 0), 0)), overdue: 0, payable: 0,
      topProducts: [],
    });
  },
  'GET /reports/sales': (req) => {
    const from = qp(req.url, 'from') || monthStart();
    const to = qp(req.url, 'to') || today();
    const by = (qp(req.url, 'groupBy') || 'day') as SalesGroup;
    const ls = lines(from, to);
    const map = new Map<string, SalesRow & { sids: Set<number> }>();
    for (const x of ls) {
      const key = by === 'day' ? x.sale.createdAt.slice(0, 10) : by === 'product' ? String(x.l.productId) : by === 'staff' ? x.sale.cashier : x.sale.channel;
      const label = by === 'product' ? x.l.name : key;
      const r = map.get(key) ?? { key, label, bills: 0, qty: 0, revenue: 0, cost: 0, profit: 0, margin: 0, sids: new Set<number>() };
      r.sids.add(x.sale.id);
      r.qty += x.qty;
      r.revenue = round2(r.revenue + x.revenue);
      r.cost = round2(r.cost + x.cost);
      map.set(key, r);
    }
    const rows = [...map.values()].map(({ sids, ...r }) => ({
      ...r, bills: sids.size, profit: round2(r.revenue - r.cost), margin: r.revenue ? Math.round(((r.revenue - r.cost) / r.revenue) * 1000) / 10 : 0,
    }));
    const rev = round2(rows.reduce((a, r) => a + r.revenue, 0));
    const cost = round2(rows.reduce((a, r) => a + r.cost, 0));
    return ok({ from, to, groupBy: by, rows, totals: { bills: new Set(ls.map((x) => x.sale.id)).size, qty: rows.reduce((a, r) => a + r.qty, 0),
      revenue: rev, cost, profit: round2(rev - cost), margin: rev ? Math.round(((rev - cost) / rev) * 1000) / 10 : 0, returns: 0 } });
  },
  'GET /reports/stock': () => {
    const st = allSerials().filter((s) => s.status === 'in_stock');
    const rows = products.map((p) => {
      const units = st.filter((s) => s.productId === p.id).length;
      const price = p.prices?.find((x) => x.tier === 'retail')?.price ?? null;
      return { productId: p.id, name: p.name, sku: p.sku, units, value: 0, retailValue: price === null ? null : price * units, oldestDays: 0 };
    }).filter((r) => r.units > 0);
    const byStatus: Record<string, number> = {};
    for (const s of allSerials()) byStatus[s.status] = (byStatus[s.status] ?? 0) + 1;
    return ok({ rows, totals: { units: st.length, value: 0, retailValue: rows.reduce((a, r) => a + (r.retailValue ?? 0), 0) }, byStatus });
  },
  'GET /reports/purchases': (req) => ok({ from: qp(req.url, 'from') || monthStart(), to: qp(req.url, 'to') || today(), rows: [],
    totals: { bills: 0, billed: 0, paid: 0, payable: 0 } }),
  'GET /reports/repairs': (req) => {
    const from = qp(req.url, 'from') || monthStart();
    const to = qp(req.url, 'to') || today();
    const done = jobs.filter((j) => j.status === 'delivered' && j.deliveredAt && inRange(j.deliveredAt, from, to));
    const open: Record<string, number> = {};
    for (const j of jobs.filter((x) => !['delivered', 'cancelled'].includes(x.status))) open[j.status] = (open[j.status] ?? 0) + 1;
    return ok({ from, to, delivered: done.length, income: round2(done.reduce((a, j) => a + j.paid, 0)), labour: round2(done.reduce((a, j) => a + j.labour, 0)),
      parts: round2(done.reduce((a, j) => a + j.partsTotal, 0)), inWarranty: done.filter((j) => j.warranty === 'in_warranty').length,
      received: jobs.filter((j) => inRange(j.createdAt, from, to)).length, open, byTechnician: [] });
  },
};
