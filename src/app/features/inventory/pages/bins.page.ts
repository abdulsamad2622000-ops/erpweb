import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { UI, errorMessage } from '../../purchase/utils/ui';
import { WarehouseLocation } from '../../settings/models/location.models';
import { Warehouse } from '../../settings/models/org.models';
import { LocationsService, WarehousesService } from '../../settings/services/org.service';
import { flattenTree, pathOf } from '../../settings/utils/location-utils';
import { StockSerial } from '../models/inventory.models';
import { InventoryService } from '../services/inventory.service';
import { binCounts, serialsInBin } from '../utils/bin-utils';
import { STOCK_TONE } from '../utils/inventory-ui';
import { loadAll } from '../utils/load-all';

@Component({
  selector: 'app-bins-page',
  imports: [RouterLink, TranslocoPipe, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">{{ 'binsPage.title' | transloco }}</h1>
        @if (auth.can('inventory.putaway.create')) {
          <a routerLink="/inventory/putaway" [class]="ui.primary">{{ 'binsPage.putawayLink' | transloco }}</a>
        }
      </div>
      <p class="text-sm text-slate-600 dark:text-slate-400">{{ 'binsPage.hint' | transloco }}</p>

      <div class="max-w-sm">
        <label for="bins-wh" class="mb-1 block text-sm">{{ 'binsPage.warehouse' | transloco }}</label>
        <select id="bins-wh" [class]="ui.input" (change)="onWarehouse($event)">
          <option value="0" [selected]="warehouseId() === 0">{{ 'binsPage.chooseWarehouse' | transloco }}</option>
          @for (w of warehouses(); track w.id) {
            <option [value]="w.id" [selected]="w.id === warehouseId()">{{ w.code }} - {{ w.name }}</option>
          }
        </select>
      </div>

      @if (error(); as e) {
        <div role="alert" class="space-y-2 rounded-lg border border-red-600 p-3">
          <p class="text-sm text-red-600">{{ e }}</p>
          <button type="button" [class]="ui.btn" (click)="load()">{{ 'common.retry' | transloco }}</button>
        </div>
      } @else if (loading()) {
        <p role="status" class="text-sm text-slate-500">{{ 'common.loading' | transloco }}</p>
      } @else if (warehouseId() === 0) {
        <p class="text-sm text-slate-600 dark:text-slate-400">{{ 'binsPage.noWarehouse' | transloco }}</p>
      } @else {
        <div class="grid gap-4 lg:grid-cols-2">
          <div [class]="ui.card + ' space-y-3'">
            <h2 class="text-base font-semibold">{{ 'binsPage.tree' | transloco }}</h2>
            @if (!tree().length) {
              <p class="text-sm text-slate-600 dark:text-slate-400">{{ 'binsPage.noLocations' | transloco }}</p>
            }
            <ul class="space-y-1">
              @for (t of tree(); track t.row.id) {
                <li [style.padding-inline-start.rem]="t.depth * 1.25">
                  @if (t.row.level === 'bin') {
                    <button
                      type="button"
                      [class]="rowClass(t.row.id)"
                      [attr.aria-pressed]="selectedId() === t.row.id"
                      (click)="select(t.row.id)"
                    >
                      <span>{{ t.row.code }} - {{ t.row.name }}</span>
                      <span class="text-xs">{{ counts().get(t.row.id) ?? 0 }}</span>
                    </button>
                  } @else {
                    <p class="py-2 text-sm text-slate-600 dark:text-slate-400">
                      <span class="font-medium">{{ 'settingsLocations.levels.' + t.row.level | transloco }}</span>
                      {{ t.row.code }} - {{ t.row.name }}
                    </p>
                  }
                </li>
              }
              <li>
                <button type="button" [class]="rowClass(0)" [attr.aria-pressed]="selectedId() === 0" (click)="select(0)">
                  <span>{{ 'binsPage.noBin' | transloco }}</span>
                  <span class="text-xs">{{ unassigned() }}</span>
                </button>
              </li>
            </ul>
          </div>

          <div [class]="ui.card + ' space-y-3'">
            @if (selectedId() === null) {
              <p class="text-sm text-slate-600 dark:text-slate-400">{{ 'binsPage.pickBin' | transloco }}</p>
            } @else {
              <h2 class="text-base font-semibold">
                {{ selectedId() === 0 ? ('binsPage.noBin' | transloco) : selectedPath() }}
              </h2>
              <div [class]="ui.tableWrap">
                <table class="w-full min-w-[26rem] text-start text-sm">
                  <caption class="sr-only">{{ 'binsPage.serials' | transloco }}</caption>
                  <thead [class]="ui.thead"><tr>
                    <th scope="col" [class]="ui.th">{{ 'purchase.grn.serial' | transloco }}</th>
                    <th scope="col" [class]="ui.th">{{ 'binsPage.product' | transloco }}</th>
                    <th scope="col" [class]="ui.th">{{ 'purchase.statusCol' | transloco }}</th>
                  </tr></thead>
                  <tbody>
                    @for (s of shown(); track s.serial) {
                      <tr [class]="ui.tr">
                        <td [class]="ui.td">
                          <a [routerLink]="['/inventory/serials', s.serial]" class="font-medium text-[#1E3A8A] underline dark:text-sky-300"><code dir="ltr">{{ s.serial }}</code></a>
                        </td>
                        <td [class]="ui.td">{{ s.name }}</td>
                        <td [class]="ui.td"><app-status-badge [label]="'inventory.status.' + s.status | transloco" [tone]="tone[s.status]" /></td>
                      </tr>
                    } @empty {
                      <tr><td colspan="3" class="px-4 py-6 text-center text-slate-500">{{ 'binsPage.emptyBin' | transloco }}</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            }
          </div>
        </div>
      }
    </section>
  `,
})
export class BinsPage implements OnInit {
  private readonly whApi = inject(WarehousesService);
  private readonly locApi = inject(LocationsService);
  private readonly inv = inject(InventoryService);
  private readonly i18n = inject(TranslocoService);
  protected readonly auth = inject(AuthStore);
  protected readonly ui = UI;
  protected readonly tone = STOCK_TONE;

  protected readonly warehouses = signal<Warehouse[]>([]);
  private readonly allLocations = signal<WarehouseLocation[]>([]);
  private readonly serials = signal<StockSerial[]>([]);
  protected readonly warehouseId = signal(0);
  protected readonly selectedId = signal<number | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  private readonly locations = computed(() => this.allLocations().filter((l) => l.warehouseId === this.warehouseId()));
  protected readonly tree = computed(() => flattenTree(this.locations(), new Set<number>()));
  private readonly here = computed(() => this.serials().filter((s) => s.warehouseId === this.warehouseId()));
  protected readonly counts = computed(() => binCounts(this.here()));
  protected readonly unassigned = computed(() => serialsInBin(this.here(), 0).length);
  protected readonly shown = computed(() => {
    const id = this.selectedId();
    return id === null ? [] : serialsInBin(this.here(), id);
  });
  protected readonly selectedPath = computed(() => {
    const loc = this.locations().find((l) => l.id === this.selectedId());
    return loc ? pathOf(this.locations(), loc).map((p) => p.code).join(' / ') : '';
  });

  ngOnInit(): void {
    void this.load();
  }

  protected rowClass(id: number): string {
    const base = 'flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border px-3 text-start text-sm ';
    return base + (this.selectedId() === id ? 'border-[#2563EB] bg-blue-50 dark:bg-slate-800' : 'border-slate-300 dark:border-slate-600');
  }

  protected onWarehouse(e: Event): void {
    this.warehouseId.set(Number((e.target as HTMLSelectElement).value) || 0);
    this.selectedId.set(null);
  }

  protected select(id: number): void {
    this.selectedId.set(id);
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [whs, locs, serials] = await Promise.all([
        loadAll(this.whApi),
        loadAll(this.locApi),
        firstValueFrom(this.inv.serials()),
      ]);
      this.warehouses.set(whs);
      this.allLocations.set(locs);
      this.serials.set(serials);
      if (this.warehouseId() === 0 && whs.length) this.warehouseId.set(whs[0].id);
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('errors.generic')));
    } finally {
      this.loading.set(false);
    }
  }
}