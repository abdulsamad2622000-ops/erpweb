import { CashEntry, Expense, ExpenseCategory, ExpenseInput } from '../../../features/accounts/models/accounts.models';
import { runningBalance } from '../../../features/accounts/utils/accounts-utils';
import { EmailLog, EmailTemplate } from '../../../features/email/models/email.models';
import { round2 } from '../../../features/pos/utils/pos-utils';
import { FixtureHandler, FixtureResponse, fail, ok } from './fixture.types';
import { sales } from './pos.fixtures';
import { jobs } from './repairs.fixtures';

const qp = (url: string, k: string): string => new URL(url, 'http://x').searchParams.get(k) ?? '';
const segs = (url: string): string[] => url.split('?')[0].split('/').filter(Boolean);
const idAfter = (url: string, name: string): number => {
  const p = segs(url);
  return Number(p[p.lastIndexOf(name) + 1]);
};
const today = (): string => new Date().toISOString().slice(0, 10);

const categories: ExpenseCategory[] = ['Rent', 'Salaries', 'Electricity', 'Internet & phone', 'Transport', 'Repairs & maintenance',
  'Tea & refreshments', 'Marketing', 'Other'].map((name, i) => ({ id: i + 1, name, isActive: true }));
export const expenses: Expense[] = [];

const templates: EmailTemplate[] = [
  { key: 'invoice', name: 'Invoice', subject: 'Invoice {{number}} from {{company}}', body: 'Dear {{customer}},\n\nYour invoice {{number}} is for Rs {{total}}.\nBalance due: Rs {{balance}}{{due_line}}.\n\n{{lines}}\n\nRegards,\n{{company}}',
    isActive: true, variables: ['company', 'customer', 'number', 'date', 'total', 'balance', 'due_line', 'lines'], updatedAt: new Date().toISOString() },
  { key: 'statement', name: 'Account statement', subject: 'Account statement from {{company}}', body: 'Dear {{customer}},\n\nYour balance is Rs {{balance}} as of {{date}}.\n\n{{lines}}\n\nRegards,\n{{company}}',
    isActive: true, variables: ['company', 'customer', 'date', 'balance', 'lines'], updatedAt: new Date().toISOString() },
  { key: 'repair_ready', name: 'Repair ready', subject: 'Your laptop is ready – {{number}}', body: 'Dear {{customer}},\n\nYour {{device}} (job {{number}}) is ready. Charges: Rs {{total}}.\n\nRegards,\n{{company}}',
    isActive: true, variables: ['company', 'customer', 'number', 'device', 'total'], updatedAt: new Date().toISOString() },
];
const logs: EmailLog[] = [];

function saveExpense(b: ExpenseInput, id?: number): FixtureResponse {
  if (!b?.date || b.date > today()) return fail(422, 'Date cannot be in the future.');
  const cat = categories.find((c) => c.id === b.categoryId);
  if (!cat) return fail(422, 'Pick a category.');
  if (!(b.amount >= 1)) return fail(422, 'Enter the amount.');
  const base = { date: b.date, categoryId: cat.id, category: cat.name, branchId: b.branchId ?? null, amount: round2(b.amount), method: b.method,
    paidTo: (b.paidTo ?? '').trim(), reference: b.reference ?? null, note: b.note ?? null };
  if (id) {
    const e = expenses.find((x) => x.id === id);
    if (!e) return fail(404, 'Expense not found.');
    if (e.voided) return fail(409, 'This expense is voided.');
    Object.assign(e, base);
    return ok(e);
  }
  const e: Expense = { id: expenses.length + 1, number: `EXP-${String(expenses.length + 1).padStart(5, '0')}`, ...base, voided: false, voidReason: null,
    createdBy: 'Mock user', createdAt: new Date().toISOString() };
  expenses.push(e);
  return { status: 201, body: e };
}

function cashbook(url: string): FixtureResponse {
  const from = qp(url, 'from') || today();
  const to = qp(url, 'to') || from;
  const method = qp(url, 'method') || 'cash';
  const rows: Omit<CashEntry, 'balance'>[] = [];
  for (const s of sales) {
    for (const p of s.payments) rows.push({ at: s.createdAt, type: 'sale', ref: s.number, method: p.method, in: p.amount, out: 0, note: null });
    if (s.change > 0) rows.push({ at: s.createdAt, type: 'change', ref: s.number, method: 'cash', in: 0, out: s.change, note: null });
    for (const r of s.returns.filter((x) => x.refundMethod !== 'credit')) {
      rows.push({ at: r.createdAt, type: 'refund', ref: r.number, method: r.refundMethod as 'cash', in: 0, out: r.amount, note: null });
    }
  }
  for (const j of jobs.filter((x) => x.status === 'delivered' && x.paid > 0)) {
    rows.push({ at: j.deliveredAt ?? j.createdAt, type: 'repair', ref: j.number, method: j.paidMethod ?? 'cash', in: j.paid, out: 0, note: j.device });
  }
  for (const e of expenses.filter((x) => !x.voided)) {
    rows.push({ at: `${e.date}T12:00:00.000Z`, type: 'expense', ref: e.number, method: e.method, in: 0, out: e.amount, note: e.category });
  }
  const mine = rows.filter((r) => method === 'all' || r.method === method).sort((a, b) => a.at.localeCompare(b.at));
  const before = mine.filter((r) => r.at.slice(0, 10) < from);
  const opening = round2(before.reduce((a, r) => a + r.in - r.out, 0));
  const entries = runningBalance(opening, mine.filter((r) => r.at.slice(0, 10) >= from && r.at.slice(0, 10) <= to));
  return ok({ from, to, method, opening, totalIn: round2(entries.reduce((a, r) => a + r.in, 0)), totalOut: round2(entries.reduce((a, r) => a + r.out, 0)),
    closing: entries.length ? entries[entries.length - 1].balance : opening, entries });
}

function sent(key: string, to: string, ref: string | null): FixtureResponse {
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to ?? '')) return fail(422, 'Enter a valid email.');
  const t = templates.find((x) => x.key === key)!;
  logs.unshift({ id: logs.length + 1, templateKey: key, to, subject: t.subject, status: 'sent', error: null, ref, by: 'Mock user', at: new Date().toISOString() });
  return ok({ status: 'sent', subject: t.subject });
}

export const ACCOUNT_FIXTURES: Record<string, FixtureHandler> = {
  'GET /accounts/expense-categories': () => ok(categories),
  'POST /accounts/expense-categories': (req) => {
    const name = ((req.body as { name: string })?.name ?? '').trim();
    if (name.length < 2) return fail(422, 'Enter a name.');
    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) return fail(422, 'This category already exists.');
    const c = { id: categories.length + 1, name, isActive: true };
    categories.push(c);
    return { status: 201, body: c };
  },
  'GET /accounts/expenses': (req) => {
    const from = qp(req.url, 'from');
    const to = qp(req.url, 'to');
    const cat = Number(qp(req.url, 'categoryId'));
    const rows = [...expenses].reverse().filter((e) => (!from || e.date >= from) && (!to || e.date <= to) && (!cat || e.categoryId === cat));
    return ok({ data: rows, total: rows.length, sum: round2(rows.filter((e) => !e.voided).reduce((a, e) => a + e.amount, 0)) });
  },
  'POST /accounts/expenses': (req) => saveExpense(req.body as ExpenseInput),
  'PUT /accounts/expenses/:id': (req) => saveExpense(req.body as ExpenseInput, idAfter(req.url, 'expenses')),
  'POST /accounts/expenses/:id/void': (req) => {
    const e = expenses.find((x) => x.id === idAfter(req.url, 'expenses'));
    if (!e) return fail(404, 'Expense not found.');
    const reason = ((req.body as { reason: string })?.reason ?? '').trim();
    if (reason.length < 10) return fail(422, 'Write a reason of at least 10 characters.');
    Object.assign(e, { voided: true, voidReason: reason });
    return ok(e);
  },
  'GET /accounts/cashbook': (req) => cashbook(req.url),
  'GET /reports/profit': (req) => {
    const from = qp(req.url, 'from') || `${today().slice(0, 8)}01`;
    const to = qp(req.url, 'to') || today();
    const revenue = round2(sales.filter((s) => s.createdAt.slice(0, 10) >= from && s.createdAt.slice(0, 10) <= to).reduce((a, s) => a + s.total, 0));
    const repair = round2(jobs.filter((j) => j.status === 'delivered' && (j.deliveredAt ?? '').slice(0, 10) >= from && (j.deliveredAt ?? '').slice(0, 10) <= to)
      .reduce((a, j) => a + j.paid, 0));
    const ex = expenses.filter((e) => !e.voided && e.date >= from && e.date <= to);
    const byCat = new Map<string, number>();
    for (const e of ex) byCat.set(e.category, round2((byCat.get(e.category) ?? 0) + e.amount));
    const exp = round2(ex.reduce((a, e) => a + e.amount, 0));
    return ok({ from, to, salesRevenue: revenue, costOfGoods: 0, salesProfit: revenue, repairIncome: repair, repairPartsCost: 0,
      grossProfit: round2(revenue + repair), expenses: exp, expensesByCategory: [...byCat].map(([category, amount]) => ({ category, amount })),
      netProfit: round2(revenue + repair - exp) });
  },
  'GET /email/templates': () => ok({ templates, mailer: 'log', from: 'no-reply@novastackhub.com' }),
  'PUT /email/templates/:id': (req) => {
    const key = segs(req.url).pop()!;
    const t = templates.find((x) => x.key === key);
    if (!t) return fail(404, 'Template not found.');
    const b = req.body as Pick<EmailTemplate, 'subject' | 'body' | 'isActive'>;
    if (!b?.subject?.trim() || !b.body?.trim()) return fail(422, 'Subject and body are required.');
    Object.assign(t, { subject: b.subject.trim(), body: b.body.trim(), isActive: b.isActive ?? true, updatedAt: new Date().toISOString() });
    return ok(t);
  },
  'POST /email/templates/:id/test': (req) => sent(segs(req.url).slice(-2)[0], (req.body as { to: string })?.to, 'test'),
  'GET /email/logs': () => ok({ data: logs, total: logs.length }),
  'POST /sales/invoices/:id/email': (req) => sent('invoice', (req.body as { to?: string })?.to ?? '', null),
  'POST /customers/:id/statement-email': (req) => sent('statement', (req.body as { to?: string })?.to ?? '', null),
  'POST /warranty/jobs/:id/email': (req) => sent('repair_ready', (req.body as { to?: string })?.to ?? '', null),
};
