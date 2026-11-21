import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Observable, firstValueFrom } from 'rxjs';
import { TableQuery } from '../../../shared/ui/data-table/data-table.models';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { Product } from '../../products/models';
import { Paged, ProductsService } from '../../products/services/products.service';
import { UI, errorMessage } from '../../purchase/utils/ui';
import { Branch, Warehouse } from '../../settings/models/org.models';
import { BranchesService, WarehousesService } from '../../settings/services/org.service';
import { StockSerial, StockSummaryRow } from '../models/inventory.models';
import { InventoryService } from '../services/inventory.service';
import { agingRows, lowStockRows } from '../utils/alert-utils';

/** Saare pages ek ek karke laata hai (bade catalog mein bhi koi product na chhute). */
async function loadAll<T>(api: { list(q: Partial<TableQuery>): Observable<Paged<T>> }): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= 50; page++) {
    const res = await firstValueFrom(api.list({ page, pageSize: 200 }));
    all.push(...res.data);
    if (res.data.length === 0 || all.length >= res.total) break;
  }
  return all;
}

type TabId = 'low' | 'aging';

@Component({
  selector: 'app-alerts-page',
  imports: [RouterLink, TranslocoPipe, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">{{ 'inventory.alerts.title' | transloco }}</h1>
        <a routerLink="/inventory/stock" [class]="ui.btn">{{ 'inventory.alerts.toStock' | transloco }}</a>
      </div>
      <p class="text-sm text-slate-600 dark:text-slate-400">{{ 'inventory.alerts.hint' | transloco }}</p>

      @if (error(); as e) {
        <div role="alert" class="space-y-2 rounded-lg border border-red-600 p-3">
          <p class="text-sm text-red-600">{{ e }}</p>
          <button type="button" [class]="ui.btn" (click)="load()">{{ 'common.retry' | transloco }}</button>
        </div>
      } @else if (loading()) {
        <p role="status" class="text-sm text-slate-500">{{ 'common.loading' | transloco }}</p>
      } @else {
        <div
          role="tablist"
          [attr.aria-label]="'inventory.alerts.tabsLabel' | transloco"
          class="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-700"
        >
          @for (t of tabs; track t) {
            <button
              type="button"
              role="tab"
              [id]="'tab-' + t"
              [attr.aria-selected]="tab() === t"
              [attr.aria-controls]="'panel-' + t"
              [attr.tabindex]="tab() === t ? 0 : -1"
              class="min-h-12 whitespace-nowrap border-b-2 px-4 text-sm font-medium"
              [class.border-[#2563EB]]="tab() === t"
              [class.text-[#2563EB]]="tab() === t"
              [class.border-transparent]="tab() !== t"
              (click)="tab.set(t)"
              (keydown)="onTabKey($event)"
            >
              {{ 'inventory.alerts.tabs.' + t | transloco }} ({{ t === 'low' ? low().length : oldCount() }})
            </button>
          }
        </div>

        @if (tab() === 'low') {
          <div id="panel-low" role="tabpanel" aria-labelledby="tab-low" class="space-y-3">
            @if (!hasLevels()) {
              <p class="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-600 dark:border-slate-600 dark:text-slate-400">
                {{ 'inventory.alerts.low.noLevels' | transloco }}
              </p>
            }
            <div [class]="ui.tableWrap">
              <table class="w-full min-w-[40rem] text-start text-sm">
                <caption class="sr-only">{{ 'inventory.alerts.tabs.low' | transloco }}</caption>
                <thead [class]="ui.thead"><tr>
                  <th scope="col" [class]="ui.th">{{ 'inventory.alerts.low.product' | transloco }}</th>
                  <th scope="col" [class]="ui.th">{{ 'inventory.alerts.low.branch' | transloco }}</th>
                  <th scope="col" [class]="ui.th + ' text-end'">{{ 'inventory.alerts.low.inStock' | transloco }}</th>
                  <th scope="col" [class]="ui.th + ' text-end'">{{ 'inventory.alerts.low.level' | transloco }}</th>
                  <th scope="col" [class]="ui.th + ' text-end'">{{ 'inventory.alerts.low.short' | transloco }}</th>
                  <th scope="col" [class]="ui.th">{{ 'purchase.statusCol' | transloco }}</th>
                </tr></thead>
                <tbody>
                  @for (r of low(); track r.productId + ':' + r.branchId) {
                    <tr [class]="ui.tr">
                      <td [class]="ui.td">
                        <span class="font-medium">{{ r.name }}</span>
                        <code dir="ltr" class="ms-2 text-xs text-slate-600 dark:text-slate-400">{{ r.sku }}</code>
                      </td>
                      <td [class]="ui.td">{{ branchName(r.branchId) }}</td>
                      <td [class]="ui.td + ' text-end'">{{ r.inStock }}</td>
                      <td [class]="ui.td + ' text-end'">{{ r.level }}</td>
                      <td [class]="ui.td + ' text-end'">{{ r.short > 0 ? r.short : '-' }}</td>
                      <td [class]="ui.td">
                        <app-status-badge
                          [label]="(r.out ? 'inventory.alerts.badge.out' : 'inventory.alerts.badge.low') | transloco"
                          [tone]="r.out ? 'danger' : 'warning'"
                        />
                      </td>
                    </tr>
                  } @empty {
                    <tr><td colspan="6" class="px-4 py-6 text-center text-slate-500">{{ 'inventory.alerts.low.empty' | transloco }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        } @else {
          <div id="panel-aging" role="tabpanel" aria-labelledby="tab-aging" class="space-y-3">
            <p class="text-sm text-slate-600 dark:text-slate-400">{{ 'inventory.alerts.aging.note' | transloco }}</p>
            <div [class]="ui.tableWrap">
              <table class="w-full min-w-[48rem] text-start text-sm">
                <caption class="sr-only">{{ 'inventory.alerts.tabs.aging' | transloco }}</caption>
                <thead [class]="ui.thead"><tr>
                  <th scope="col" [class]="ui.th">{{ 'inventory.alerts.aging.product' | transloco }}</th>
                  <th scope="col" [class]="ui.th">{{ 'inventory.alerts.aging.warehouse' | transloco }}</th>
                  <th scope="col" [class]="ui.th + ' text-end'">{{ 'inventory.alerts.aging.d0_30' | transloco }}</th>
                  <th scope="col" [class]="ui.th + ' text-end'">{{ 'inventory.alerts.aging.d31_60' | transloco }}</th>
                  <th scope="col" [class]="ui.th + ' text-end'">{{ 'inventory.alerts.aging.d61_90' | transloco }}</th>
                  <th scope="col" [class]="ui.th + ' text-end'">{{ 'inventory.alerts.aging.d90_plus' | transloco }}</th>
                  <th scope="col" [class]="ui.th + ' text-end'">{{ 'inventory.alerts.aging.total' | transloco }}</th>
                  <th scope="col" [class]="ui.th + ' text-end'">{{ 'inventory.alerts.aging.oldest' | transloco }}</th>
                  <th scope="col" [class]="ui.th">{{ 'purchase.statusCol' | transloco }}</th>
                </tr></thead>
                <tbody>
                  @for (r of aging(); track r.productId + ':' + r.warehouseId) {
                    <tr [class]="ui.tr">
                      <td [class]="ui.td">
                        <span class="font-medium">{{ r.name }}</span>
                        <code dir="ltr" class="ms-2 text-xs text-slate-600 dark:text-slate-400">{{ r.sku }}</code>
                      </td>
                      <td [class]="ui.td">{{ warehouseName(r.warehouseId) }}</td>
                      <td [class]="ui.td + ' text-end'">{{ r.d0_30 }}</td>
                      <td [class]="ui.td + ' text-end'">{{ r.d31_60 }}</td>
                      <td [class]="ui.td + ' text-end'">{{ r.d61_90 }}</td>
                      <td [class]="ui.td + ' text-end'">{{ r.d90_plus }}</td>
                      <td [class]="ui.td + ' text-end'">{{ r.total }}</td>
                      <td [class]="ui.td + ' text-end'">{{ r.oldest }}</td>
                      <td [class]="ui.td">
                        @if (r.d90_plus > 0) {
                          <app-status-badge [label]="'inventory.alerts.badge.aging' | transloco" tone="warning" />
                        }
                      </td>
                    </tr>
                  } @empty {
                    <tr><td colspan="9" class="px-4 py-6 text-center text-slate-500">{{ 'inventory.alerts.aging.empty' | transloco }}</td></tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      }
    </section>
  `,
})
export class AlertsPage implements OnInit {
  private readonly productsApi = inject(ProductsService);
  private readonly warehousesApi = inject(WarehousesService);
  private readonly branchesApi = inject(BranchesService);
  private readonly inv = inject(InventoryService);
  private readonly i18n = inject(TranslocoService);
  protected readonly ui = UI;

  protected readonly tabs = ['low', 'aging'] as const;
  protected readonly tab = signal<TabId>('low');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  private readonly products = signal<Product[]>([]);
  private readonly warehouses = signal<Warehouse[]>([]);
  private readonly branches = signal<Branch[]>([]);
  private readonly stock = signal<StockSummaryRow[]>([]);
  private readonly serials = signal<StockSerial[]>([]);
  private readonly now = signal(new Date());

  protected readonly low = computed(() => lowStockRows(this.products(), this.warehouses(), this.stock()));
  protected readonly aging = computed(() => agingRows(this.serials(), this.now()));
  protected readonly oldCount = computed(() => this.aging().filter((r) => r.d90_plus > 0).length);
  protected readonly hasLevels = computed(() =>
    this.products().some((p) => p.isActive && (p.reorderLevels?.length ?? 0) > 0),
  );
  private readonly branchNames = computed(
    () => new Map<number, string>(this.branches().map((b) => [b.id, b.name] as [number, string])),
  );
  private readonly warehouseNames = computed(
    () => new Map<number, string>(this.warehouses().map((w) => [w.id, w.name] as [number, string])),
  );

  ngOnInit(): void {
    void this.load();
  }

  protected branchName(id: number): string {
    return this.branchNames().get(id) ?? `#${id}`;
  }

  protected warehouseName(id: number): string {
    if (id === 0) return this.i18n.translate('inventory.adjustments.inTransit');
    return this.warehouseNames().get(id) ?? `#${id}`;
  }

  protected onTabKey(e: KeyboardEvent): void {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const next: TabId = this.tab() === 'low' ? 'aging' : 'low';
    this.tab.set(next);
    queueMicrotask(() => document.getElementById(`tab-${next}`)?.focus());
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [products, warehouses, branches, stock, serials] = await Promise.all([
        loadAll(this.productsApi),
        loadAll(this.warehousesApi),
        loadAll(this.branchesApi),
        firstValueFrom(this.inv.stock()),
        firstValueFrom(this.inv.serials('', 'in_stock')),
      ]);
      this.products.set(products);
      this.warehouses.set(warehouses);
      this.branches.set(branches);
      this.stock.set(stock);
      this.serials.set(serials);
      this.now.set(new Date());
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('errors.generic')));
    } finally {
      this.loading.set(false);
    }
  }
}