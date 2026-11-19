import { describe, expect, it } from 'vitest';
import { ORG_FIXTURES } from './org.fixtures';

const call = (key: string, url: string, body: unknown = null) =>
  ORG_FIXTURES[key]({ method: key.split(' ')[0], url, body });

const namesOf = (res: { body: unknown }): string[] =>
  (res.body as { data: { name: string }[] }).data.map((r) => r.name);

const branch = { code: 'FSD', name: 'Faisalabad Branch', city: 'Faisalabad', address: '', phone: '', isActive: true };
const warehouse = { branchId: 1, code: 'LHR-NEW', name: 'Lahore Returns', type: 'returns', isActive: true };

describe('ORG_FIXTURES', () => {
  it('branches: lists and searches', () => {
    expect(namesOf(call('GET /branches', '/branches?pageSize=50')).length).toBeGreaterThanOrEqual(3);
    expect(namesOf(call('GET /branches', '/branches?search=karachi'))).toEqual(['Karachi Branch']);
  });

  it('branches: creates, rejects duplicate code and name, deletes an unused branch', () => {
    const created = call('POST /branches', '/branches', branch);
    expect(created.status).toBe(200);
    const id = (created.body as { id: number }).id;
    expect(call('POST /branches', '/branches', { ...branch, name: 'Other' }).status).toBe(422);
    expect(call('POST /branches', '/branches', { ...branch, code: 'XYZ' }).status).toBe(422);
    expect(call('DELETE /branches/:id', `/branches/${id}`).status).toBe(200);
  });

  it('branches: one with warehouses cannot be deleted (409)', () => {
    expect(call('DELETE /branches/:id', '/branches/1').status).toBe(409);
  });

  it('warehouses: lists, creates and edits', () => {
    expect(namesOf(call('GET /warehouses', '/warehouses?pageSize=50')).length).toBeGreaterThanOrEqual(6);
    const created = call('POST /warehouses', '/warehouses', warehouse);
    expect(created.status).toBe(200);
    const id = (created.body as { id: number }).id;
    const edited = call('PUT /warehouses/:id', `/warehouses/${id}`, { ...warehouse, name: 'Lahore Returns 2' });
    expect((edited.body as { name: string }).name).toBe('Lahore Returns 2');
    expect(call('DELETE /warehouses/:id', `/warehouses/${id}`).status).toBe(200);
  });

  it('warehouses: rejects unknown branch, bad type and duplicate code', () => {
    expect(call('POST /warehouses', '/warehouses', { ...warehouse, branchId: 99 }).status).toBe(422);
    expect(call('POST /warehouses', '/warehouses', { ...warehouse, type: 'garage' }).status).toBe(422);
    expect(call('POST /warehouses', '/warehouses', { ...warehouse, code: 'LHR-SELL' }).status).toBe(422);
  });
});