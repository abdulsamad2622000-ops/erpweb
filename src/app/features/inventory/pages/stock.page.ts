import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { Warehouse } from '../../settings/models/org.models';
import { WarehousesService } from '../../settings/services/org.service';
import { StockSummaryRow } from '../models/inventory.models';
import { InventoryService } from '../services/inventory.service';
import { UI } from '../../purchase/utils/ui';

@Component({
  selector: 'app-stock-page',
  imports: [FormsModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl space-y-4">
      <h1 class="text-xl font-semibold">{{ 'inventory.stock.title' | transloco }}</h1>

      <div class="max-w-sm">
        <label for="stock-wh" class="mb-1 block text-sm">{{ 'inventory.stock.warehouse' | transloco }}</label>
        <select id="stock-wh" [class]="ui.input" [ngModel]="warehouseId()" (ngModelChange)="setWarehouse(+$event)">
          <option [ngValue]="0">{{ 'inventory.stock.allWarehouses' | transloco }}</option>
          @for (w of warehouses(); track w.id) { <option [ngValue]="w.id">{{ w.name }}</option> }
        </select>
      </div>

      @if (error(); as e) {
        <div role="alert" class="space-y-2 rounded-lg border border-red-600 p-3">
          <p class="text-sm text-red-600">{{ e }}</p>
          <button type="button" [class]="ui.btn" (click)="load()">{{ 'common.retry' | transloco }}</button>
        </div>
      }

      <div [class]="ui.tableWrap">
        <table class="w-full min-w-[52rem] text-start text-sm">
          <thead [class]="ui.thead"><tr>
            <th scope="col" [class]="ui.th">{{ 'inventory.stock.product' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'inventory.stock.warehouse' | transloco }}</th>
            <th scope="col" [class]="ui.th + ' text-end'">{{ 'inventory.status.in_stock' | transloco }}</th>
            <th scope="col" [class]="ui.th + ' text-end'">{{ 'inventory.stock.reserved' | transloco }}</th>
            <th scope="col" [class]="ui.th + ' text-end'">{{ 'inventory.stock.available' | transloco }}</th>
            <th scope="col" [class]="ui.th + ' text-end'">{{ 'inventory.status.quarantine' | transloco }}</th>
            <th scope="col" [class]="ui.th + ' text-end'">{{ 'inventory.status.rejected' | transloco }}</th>
            <th scope="col" [class]="ui.th + ' text-end'">{{ 'inventory.status.returned' | transloco }}</th>
            <th scope="col" [class]="ui.th + ' text-end'">{{ 'inventory.status.damaged' | transloco }}</th>
          </tr></thead>
          <tbody>
            @if (loading()) {
              <tr><td colspan="9" class="px-4 py-6 text-center text-slate-500" role="status">{{ 'common.loading' | transloco }}</td></tr>
            } @else {
              @for (r of rows(); track r.productId + '-' + r.warehouseId) {
                <tr [class]="ui.tr">
                  <td [class]="ui.td"><span class="font-medium">{{ r.name }}</span><br /><span class="text-xs text-slate-500">{{ r.sku }}</span></td>
                  <td [class]="ui.td">{{ warehouseName(r.warehouseId) }}</td>
                  <td [class]="ui.td + ' text-end'">{{ r.inStock }}</td>
                  <td [class]="ui.td + ' text-end'">{{ r.reserved ?? 0 }}</td>
                  <td [class]="ui.td + ' text-end font-medium'">{{ available(r) }}</td>
                  <td [class]="ui.td + ' text-end'">{{ r.quarantine }}</td>
                  <td [class]="ui.td + ' text-end'">{{ r.rejected }}</td>
                  <td [class]="ui.td + ' text-end'">{{ r.returned }}</td>
                  <td [class]="ui.td + ' text-end'">{{ r.damaged }}</td>
                </tr>
              } @empty {
                <tr><td colspan="9" class="px-4 py-6 text-center text-slate-500">{{ 'inventory.stock.empty' | transloco }}</td></tr>
              }
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class StockPage implements OnInit {
  private readonly api = inject(InventoryService);
  private readonly whApi = inject(WarehousesService);
  private readonly i18n = inject(TranslocoService);
  protected readonly ui = UI;

  protected readonly rows = signal<StockSummaryRow[]>([]);
  protected readonly warehouses = signal<Warehouse[]>([]);
  protected readonly warehouseId = signal(0);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly names = computed(() => new Map(this.warehouses().map((w) => [w.id, w.name] as [number, string])));

  ngOnInit(): void {
    void this.init();
  }

  protected warehouseName(id: number): string {
    return this.names().get(id) ?? '-';
  }

  /** Bechne ke liye kitna bacha hai: in-stock minus reserved. */
  protected available(r: StockSummaryRow): number {
    return r.inStock - (r.reserved ?? 0);
  }

  private async init(): Promise<void> {
    try {
      this.warehouses.set((await firstValueFrom(this.whApi.list({ pageSize: 500 }))).data);
    } catch {
      // Naam '-' dikhega, table phir bhi chalegi.
    }
    await this.load();
  }

  protected setWarehouse(id: number): void {
    this.warehouseId.set(id);
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.rows.set(await firstValueFrom(this.api.stock(this.warehouseId() || null)));
    } catch {
      this.error.set(this.i18n.translate('errors.generic'));
    } finally {
      this.loading.set(false);
    }
  }
}