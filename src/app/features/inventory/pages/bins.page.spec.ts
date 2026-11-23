import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { Observable, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { AuthStore } from '../../../core/auth/auth.store';
import { LocationLevel, WarehouseLocation } from '../../settings/models/location.models';
import { Warehouse } from '../../settings/models/org.models';
import { LocationsService, WarehousesService } from '../../settings/services/org.service';
import { StockSerial } from '../models/inventory.models';
import { InventoryService } from '../services/inventory.service';
import { BinsPage } from './bins.page';

const loc = (id: number, parentId: number | null, level: LocationLevel, code: string): WarehouseLocation => ({
  id, warehouseId: 1, parentId, level, code, name: `${level} ${code}`, barcode: level === 'bin' ? `BIN-${code}` : null, isActive: true,
});
const LOCATIONS = [loc(1, null, 'zone', 'A'), loc(2, 1, 'rack', 'R1'), loc(3, 2, 'shelf', 'S1'), loc(4, 3, 'bin', 'B01'), loc(5, 3, 'bin', 'B02')];
const WAREHOUSES: Warehouse[] = [{ id: 1, branchId: 1, code: 'LHR-SELL', name: 'Lahore Main Store', type: 'sellable', isActive: true }];

const serial = (sn: string, warehouseId: number, binId: number | null): StockSerial => ({
  serial: sn, productId: 1, name: 'Dell Latitude 5440', sku: 'LAP-1', warehouseId, status: 'in_stock',
  grnNumber: 'GRN-1', supplierName: 'Supplier', receivedAt: '2026-11-01T00:00:00.000Z', binId,
});
const SERIALS = [serial('SN-AAAA1', 1, 4), serial('SN-AAAA2', 1, 4), serial('SN-BBBB1', 1, null), serial('SN-CCCC1', 2, null)];

const list = <T>(data: T[]) => ({ list: vi.fn().mockReturnValue(of({ data, total: data.length })) });
const flush = () => new Promise<void>((resolve) => setTimeout(resolve));

function fakeAuth(keys: string[]) {
  const grantedKeys = signal(new Set(keys));
  return { grantedKeys, can: (key: string) => grantedKeys().has(key), isAuthenticated: signal(true) };
}

async function setup(keys: string[] = [], serials: Observable<StockSerial[]> = of(SERIALS)) {
  TestBed.configureTestingModule({
    imports: [
      BinsPage,
      TranslocoTestingModule.forRoot({ langs: { en: {} }, translocoConfig: { availableLangs: ['en'], defaultLang: 'en' } }),
    ],
    providers: [
      provideRouter([]),
      { provide: WarehousesService, useValue: list(WAREHOUSES) },
      { provide: LocationsService, useValue: list(LOCATIONS) },
      { provide: InventoryService, useValue: { serials: vi.fn().mockReturnValue(serials) } },
      { provide: AuthStore, useValue: fakeAuth(keys) },
    ],
  });
  const fixture = TestBed.createComponent(BinsPage);
  fixture.detectChanges();
  await flush();
  fixture.detectChanges();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

const treeButtons = (el: HTMLElement) => Array.from(el.querySelectorAll<HTMLButtonElement>('ul button'));

describe('BinsPage', () => {
  it('lists the bins of the first warehouse with their serial counts', async () => {
    const { el } = await setup();
    const buttons = treeButtons(el);
    expect(buttons.length).toBe(3);
    expect(buttons[0].textContent).toContain('B01');
    expect(buttons[0].textContent?.trim()).toMatch(/2$/);
    expect(buttons[1].textContent?.trim()).toMatch(/0$/);
  });

  it('shows the serials of the selected bin only', async () => {
    const { fixture, el } = await setup();
    treeButtons(el)[0].click();
    fixture.detectChanges();
    const body = el.querySelector('tbody')?.textContent ?? '';
    expect(body).toContain('SN-AAAA1');
    expect(body).toContain('SN-AAAA2');
    expect(body).not.toContain('SN-BBBB1');
  });

  it('shows serials without a bin under No bin yet, from this warehouse only', async () => {
    const { fixture, el } = await setup();
    treeButtons(el)[2].click();
    fixture.detectChanges();
    const body = el.querySelector('tbody')?.textContent ?? '';
    expect(body).toContain('SN-BBBB1');
    expect(body).not.toContain('SN-CCCC1');
  });

  it('shows the put-away link only with the put-away permission', async () => {
    const viewer = await setup([]);
    expect(viewer.el.querySelector('a[href="/inventory/putaway"]')).toBeNull();
    TestBed.resetTestingModule();
    const keeper = await setup(['inventory.putaway.create']);
    expect(keeper.el.querySelector('a[href="/inventory/putaway"]')).not.toBeNull();
  });

  it('shows an error with a retry button when loading fails', async () => {
    const { el } = await setup([], throwError(() => new Error('boom')));
    expect(el.querySelector('[role="alert"]')).not.toBeNull();
    expect(el.textContent).toContain('common.retry');
  });
});