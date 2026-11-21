import { describe, expect, it } from 'vitest';
import { CashBook, Expense } from '../../../features/accounts/models/accounts.models';
import { ACCOUNT_FIXTURES } from './accounts.fixtures';

const call = (key: string, url: string, body: unknown = null) => ACCOUNT_FIXTURES[key]({ method: key.split(' ')[0], url: `/api/v1${url}`, body });
const today = new Date().toISOString().slice(0, 10);

describe('ACCOUNT_FIXTURES', () => {
  it('records expense, shows in cash book, voids', () => {
    expect(call('POST /accounts/expenses', '/accounts/expenses', { date: today, categoryId: 0, amount: 10, method: 'cash' }).status).toBe(422);
    const e = call('POST /accounts/expenses', '/accounts/expenses', { date: today, categoryId: 1, amount: 2500, method: 'cash', paidTo: 'Landlord' }).body as Expense;
    expect(e.number).toMatch(/^EXP-/);
    const cb = call('GET /accounts/cashbook', `/accounts/cashbook?from=${today}&to=${today}&method=cash`).body as CashBook;
    expect(cb.entries.some((x) => x.ref === e.number && x.out === 2500)).toBe(true);
    expect(call('POST /accounts/expenses/:id/void', `/accounts/expenses/${e.id}/void`, { reason: 'short' }).status).toBe(422);
    expect((call('POST /accounts/expenses/:id/void', `/accounts/expenses/${e.id}/void`, { reason: 'Entered by mistake' }).body as Expense).voided).toBe(true);
  });
  it('sends test email and logs it', () => {
    expect(call('POST /email/templates/:id/test', '/email/templates/invoice/test', { to: 'bad' }).status).toBe(422);
    expect(call('POST /email/templates/:id/test', '/email/templates/invoice/test', { to: 'a@b.co' }).status).toBe(200);
    expect((call('GET /email/logs', '/email/logs').body as { total: number }).total).toBeGreaterThan(0);
  });
});
