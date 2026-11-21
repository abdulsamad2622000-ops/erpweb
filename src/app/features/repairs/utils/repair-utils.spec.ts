import { describe, expect, it } from 'vitest';
import { JOB_FLOW, isOpen, jobSlipHtml, jobTotal, partsTotal } from './repair-utils';

describe('repair utils', () => {
  it('totals', () => {
    const parts = [{ description: 'Cable', qty: 2, unitPrice: 750.5 }, { description: 'Paste', qty: 1, unitPrice: 300 }];
    expect(partsTotal(parts)).toBe(1801);
    expect(jobTotal(parts, 500)).toBe(2301);
  });
  it('flow', () => {
    expect(JOB_FLOW.received).toContain('diagnosing');
    expect(JOB_FLOW.ready).not.toContain('delivered'); // deliver alag action hai
    expect(isOpen('ready')).toBe(true);
    expect(isOpen('delivered')).toBe(false);
  });
  it('escapes slip', () => {
    const html = jobSlipHtml(
      { number: 'JOB-1', createdAt: '2026-11-21T10:00:00Z', customerName: 'A <b>', customerPhone: '0300', device: 'HP', serial: null,
        problem: 'Screen', accessories: '', warrantyLabel: 'In warranty', promisedOn: null, estimate: 1500 },
      { title: 'Job card', customer: 'Customer', device: 'Device', serial: 'Serial', problem: 'Problem', accessories: 'Acc', warranty: 'W',
        promised: 'P', estimate: 'E', terms: 'T' },
    );
    expect(html).toContain('A &lt;b&gt;');
    expect(html).toContain('1,500');
    expect(html).not.toContain('<th>Serial</th>');
  });
});
