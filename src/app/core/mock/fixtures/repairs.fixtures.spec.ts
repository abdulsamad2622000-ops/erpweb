import { describe, expect, it } from 'vitest';
import { RepairJob, WarrantyCheck } from '../../../features/repairs/models/repair.models';
import { REPAIR_FIXTURES } from './repairs.fixtures';

const call = (key: string, url: string, body: unknown = null) => REPAIR_FIXTURES[key]({ method: key.split(' ')[0], url: `/api/v1${url}`, body });

describe('REPAIR_FIXTURES', () => {
  it('runs a job card from intake to delivery', () => {
    expect((call('GET /warranty/check/:id', '/warranty/check/nope1').body as WarrantyCheck).warranty).toBe('not_ours');
    expect(call('POST /warranty/jobs', '/warranty/jobs', { device: 'Dell', problem: 'No power', customerName: 'Z', customerPhone: '1' }).status).toBe(422);
    const j = call('POST /warranty/jobs', '/warranty/jobs', {
      serial: null, device: 'Dell 5490', customerId: null, customerName: 'Zain', customerPhone: '0311-2223334', problem: 'No power',
      accessories: 'Charger', estimate: 3000, promisedOn: null,
    }).body as RepairJob;
    expect(j.next).toEqual(['diagnosing', 'cancelled']);
    const id = j.id;
    expect(call('POST /warranty/jobs/:id/status', `/warranty/jobs/${id}/status`, { status: 'ready' }).status).toBe(422);
    call('POST /warranty/jobs/:id/status', `/warranty/jobs/${id}/status`, { status: 'diagnosing' });
    const u = call('PUT /warranty/jobs/:id', `/warranty/jobs/${id}`, { labour: 500, parts: [{ description: 'Charging IC', qty: 1, unitPrice: 1500 }] }).body as RepairJob;
    expect(u.total).toBe(2000);
    call('POST /warranty/jobs/:id/status', `/warranty/jobs/${id}/status`, { status: 'repairing' });
    call('POST /warranty/jobs/:id/status', `/warranty/jobs/${id}/status`, { status: 'ready' });
    expect(call('POST /warranty/jobs/:id/deliver', `/warranty/jobs/${id}/deliver`, { amount: 100, method: 'cash' }).status).toBe(422);
    const d = call('POST /warranty/jobs/:id/deliver', `/warranty/jobs/${id}/deliver`, { amount: 2000, method: 'cash' }).body as RepairJob;
    expect(d.status).toBe('delivered');
    expect(d.events.length).toBe(5);
  });
});
