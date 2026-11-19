import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsService } from '../services/settings.service';
import { SettingsStore } from './settings.store';

describe('SettingsStore', () => {
  const api = {
    getCompany: vi.fn(),
    saveCompany: vi.fn(),
    listSeries: vi.fn(),
    saveSeries: vi.fn(),
    listTiers: vi.fn(),
    saveTier: vi.fn(),
    getCosting: vi.fn(),
    saveCosting: vi.fn(),
    getBackup: vi.fn(),
  };
  let store: SettingsStore;

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({ providers: [{ provide: SettingsService, useValue: api }] });
    store = TestBed.inject(SettingsStore);
  });

  it('loadCompany sets the company and clears loading', async () => {
    api.getCompany.mockReturnValue(of({ name: 'Acme' }));
    await store.loadCompany();
    expect(store.company()?.name).toBe('Acme');
    expect(store.loading()).toBe(false);
  });

  it('a failed load throws and clears loading', async () => {
    api.getBackup.mockReturnValue(throwError(() => new Error('boom')));
    await expect(store.loadBackup()).rejects.toThrow();
    expect(store.loading()).toBe(false);
  });

  it('saveCompany returns null and updates the signal on success', async () => {
    api.saveCompany.mockReturnValue(of({ name: 'New name' }));
    expect(await store.saveCompany({ name: 'New name' } as never)).toBeNull();
    expect(store.company()?.name).toBe('New name');
  });

  it('saveCompany returns the server message on failure', async () => {
    api.saveCompany.mockReturnValue(throwError(() => ({ error: { message: 'Company name is required.' } })));
    expect(await store.saveCompany({ name: '' } as never)).toBe('Company name is required.');
  });

  it('saveSeries reloads the list after a successful save', async () => {
    api.saveSeries.mockReturnValue(of({ id: 1 }));
    api.listSeries.mockReturnValue(of([{ id: 1 }]));
    expect(await store.saveSeries(1, { prefix: 'PO-', nextNumber: 2, padding: 6, resetYearly: false })).toBeNull();
    expect(api.listSeries).toHaveBeenCalled();
    expect(store.series().length).toBe(1);
  });

  it('saveTier returns a generic message when the error has none', async () => {
    api.saveTier.mockReturnValue(throwError(() => new Error('boom')));
    expect(await store.saveTier(1, { name: 'Retail', isActive: true })).toBe('Something went wrong.');
  });

  it('saveCosting updates the signal', async () => {
    api.saveCosting.mockReturnValue(of({ method: 'fifo', negativeStock: 'warn' }));
    expect(await store.saveCosting({ method: 'fifo', negativeStock: 'warn' })).toBeNull();
    expect(store.costing()?.negativeStock).toBe('warn');
  });
});