import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { UI } from '../../purchase/utils/ui';
import { Warehouse } from '../../settings/models/org.models';
import { WarehousesService } from '../../settings/services/org.service';
import { StockLedgerRow } from '../models/inventory.models';
import { InventoryService } from '../services/inventory.service';

type Direction = '' | 'in' | 'out';

@Component({
  selector: 'app-ledger-page',
  imports: [FormsModule, RouterLink, TranslocoPipe, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl space-y-4">
      <h1 class="text-xl font-semibold">{{ 'inventory.ledger.title' | transloco }}</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">{{ 'inventory.ledger.hint' | transloco }}</p>

      <div class="flex flex-wrap items-end gap-3">
        <div>
          <label for="led-q" class="mb-1 block text-sm">{{ 'common.search' | transloco }}</label>
          <input id="led-q" dir="ltr" [class]="ui.input + ' w-64'" [ngModel]="q()" (ngModelChange)="q.set($event)" />
        </div>
        <div>
          <label for="led-dir" class="mb-1 block text-sm">{{ 'inventory.ledger.direction' | transloco }}</label>
          <select id="led-dir" [class]="ui.input" [ngModel]="direction()" (ngModelChange)="direction.set($event)">
            <option value="">{{ 'inventory.ledger.all' | transloco }}</option>
            <option value="in">{{ 'inventory.ledger.in' | transloco }}</option>
            <option value="out">{{ 'inventory.ledger.out' | transloco }}</option>
          </select>
        </div>
      </div>

      @if (error(); as e) {
        <div role="alert" class="space-y-2 rounded-lg border border-red-600 p-3">
          <p class="text-sm text-red-600">{{ e }}</p>
          <button type="button" [class]="ui.btn" (click)="load()">{{ 'common.retry' | transloco }}</button>
        </div>
      }

      <div [class]="ui.tableWrap">
        <table class="w-full min-w-[44rem] text-start text-sm">
          <thead [class]="ui.thead"><tr>
            <th scope="col" [class]="ui.th">{{ 'purchase.payables.date' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'inventory.ledger.direction' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'purchase.grn.serial' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'inventory.stock.product' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'purchase.payables.ref' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'inventory.stock.warehouse' | transloco }}</th>
          </tr></thead>
          <tbody>
            @if (loading()) {
              <tr><td colspan="6" class="px-4 py-6 text-center text-slate-500" role="status">{{ 'common.loading' | transloco }}</td></tr>
            } @else {
              @for (r of filtered(); track r.id) {
                <tr [class]="ui.tr">
                  <td [class]="ui.td">{{ r.at.slice(0, 16).replace('T', ' ') }}</td>
                  <td [class]="ui.td">
                    <app-status-badge [label]="'inventory.ledger.' + r.direction | transloco" [tone]="r.direction === 'in' ? 'success' : 'neutral'" />
                  </td>
                  <td [class]="ui.td">
                    <a [routerLink]="['/inventory/serials', r.serial]" class="underline"><code dir="ltr">{{ r.serial }}</code></a>
                  </td>
                  <td [class]="ui.td">{{ r.productName }}</td>
                  <td [class]="ui.td">{{ r.ref }}</td>
                  <td [class]="ui.td">{{ warehouseName(r.warehouseId) }}</td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="px-4 py-6 text-center text-slate-500">{{ 'inventory.ledger.empty' | transloco }}</td></tr>
              }
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class LedgerPage implements OnInit {
  private readonly api = inject(InventoryService);
  private readonly whApi = inject(WarehousesService);
  private readonly i18n = inject(TranslocoService);
  protected readonly ui = UI;

  protected readonly rows = signal<StockLedgerRow[]>([]);
  protected readonly warehouses = signal<Warehouse[]>([]);
  protected readonly q = signal('');
  protected readonly direction = signal<Direction>('');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  private readonly names = computed(() => new Map(this.warehouses().map((w) => [w.id, w.name] as [number, string])));
  protected readonly filtered = computed(() => {
    const q = this.q().trim().toLowerCase();
    const d = this.direction();
    return this.rows().filter(
      (r) => (!d || r.direction === d) && (!q || [r.serial, r.productName, r.ref].some((v) => v.toLowerCase().includes(q))),
    );
  });

  ngOnInit(): void {
    void this.init();
  }

  protected warehouseName(id: number): string {
    return this.names().get(id) ?? '-';
  }

  private async init(): Promise<void> {
    try {
      this.warehouses.set((await firstValueFrom(this.whApi.list({ pageSize: 500 }))).data);
    } catch {
      // Naam '-' dikhega.
    }
    await this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.rows.set(await firstValueFrom(this.api.ledger()));
    } catch {
      this.error.set(this.i18n.translate('errors.generic'));
    } finally {
      this.loading.set(false);
    }
  }
}