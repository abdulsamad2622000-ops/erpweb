import { describe, expect, it } from 'vitest';
import { Dashboard, SalesReport } from '../../../features/reports/models/report.models';
import { REPORT_FIXTURES } from './reports.fixtures';

const call = (key: string, url: string) => REPORT_FIXTURES[key]({ method: 'GET', url: `/api/v1${url}`, body: null });

describe('REPORT_FIXTURES', () => {
  it('returns dashboard and report shapes', () => {
    const d = call('GET /dashboard', '/dashboard').body as Dashboard;
    expect(d.last14.length).toBe(14);
    const s = call('GET /reports/sales', '/reports/sales?groupBy=product').body as SalesReport;
    expect(s.groupBy).toBe('product');
    expect(s.totals.profit).toBe(s.totals.revenue - s.totals.cost);
  });
});
