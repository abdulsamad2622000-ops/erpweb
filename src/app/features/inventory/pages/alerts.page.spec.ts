import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { Observable, of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { Product } from '../../products/models';
import { ProductsService } from '../../products/services/products.service';
import { Branch, Warehouse } from '../../settings/models/org.models';
import { BranchesService, WarehousesService } from '../../settings/services/org.service';
import { StockSerial, StockSummaryRow } from '../models/inventory.models';
import { InventoryService } from '../services/inventory.service';
import { AlertsPage } from './alerts.page';

const product = (id: number, name: string, level: number): Product => ({
  id, sku: `SKU-${id}`, name, barcode: null, brandId: 1, categoryId: 1, trackBatch: false, isActive: true,
  reorderLevels: [{ branchId: 1, level }],
});
const PRODUCTS = [product(1, 'Dell Latitude 5440', 5), product(2, 'HP ProBook 450', 2)];
const BRANCHES: Branch[] = [
  { id: 1, code: 'KHI', name: 'Karachi Main', city: 'Karachi', address: '', phone: '', isActive: true },
];
const WAREHOUSES: Warehouse[] = [
  { id: 10, branchId: 1, code: 'KHI-S', name: 'Karachi Sellable', type: 'sellable', isActive: true },
];
const STOCK: StockSummaryRow[] = [
  { productId: 1, name: 'Dell Latitude 5440', sku: 'SKU-1', warehouseId: 10, inStock: 1, quarantine: 0, rejected: 0, returned: 0, damaged: 0 },
];
const SERIALS: StockSerial[] = [
  {
    serial: 'S1', productId: 1, name: 'Dell Latitude 5440', sku: 'SKU-1', warehouseId: 10, status: 'in_stock',
    grnNumber: 'GRN-1', supplierName: 'Supplier', receivedAt: new Date(Date.now() - 120 * 86_400_000).toISOString(),
  },
];

const list = <T>(data: T[]) => ({ list: vi.fn().mockReturnValue(of({ data, total: data.length })) });
const flush = () => new Promise<void>((resolve) => setTimeout(resolve));

async function setup(stock: Observable<StockSummaryRow[]> = of(STOCK)) {
  TestBed.configureTestingModule({
    imports: [
      AlertsPage,
      TranslocoTestingModule.forRoot({
        langs: { en: {} },
        translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
      }),
    ],
    providers: [
      provideRouter([]),
      { provide: ProductsService, useValue: list(PRODUCTS) },
      { provide: WarehousesService, useValue: list(WAREHOUSES) },
      { provide: BranchesService, useValue: list(BRANCHES) },
      { provide: InventoryService, useValue: { stock: vi.fn().mockReturnValue(stock), serials: vi.fn().mockReturnValue(of(SERIALS)) } },
    ],
  });
  const fixture = TestBed.createComponent(AlertsPage);
  fixture.detectChanges();
  await flush();
  fixture.detectChanges();
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('AlertsPage', () => {
  it('lists low and out of stock products with their branch', async () => {
    const { el } = await setup();
    const body = el.querySelector('tbody')?.textContent ?? '';
    expect(body).toContain('Dell Latitude 5440');
    expect(body).toContain('HP ProBook 450');
    expect(body).toContain('Karachi Main');
    expect(body).toContain('inventory.alerts.badge.low');
    expect(body).toContain('inventory.alerts.badge.out');
  });

  it('shows old stock on the aging tab', async () => {
    const { fixture, el } = await setup();
    el.querySelector<HTMLButtonElement>('#tab-aging')?.click();
    fixture.detectChanges();
    const body = el.querySelector('tbody')?.textContent ?? '';
    expect(body).toContain('Dell Latitude 5440');
    expect(body).toContain('Karachi Sellable');
    expect(body).toContain('120');
    expect(body).toContain('inventory.alerts.badge.aging');
  });

  it('shows an error with a retry button when loading fails', async () => {
    const { el } = await setup(throwError(() => new Error('boom')));
    expect(el.querySelector('[role="alert"]')).not.toBeNull();
    expect(el.textContent).toContain('common.retry');
  });
});