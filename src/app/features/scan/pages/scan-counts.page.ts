import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { StockCount } from '../../inventory/models/count.models';
import { CountsService } from '../../inventory/services/counts.service';
import { COUNT_TONE } from '../../inventory/utils/count-utils';
import { errorMessage } from '../../purchase/utils/ui';
import { Warehouse } from '../../settings/models/org.models';
import { OfflineCacheService } from '../services/offline-cache.service';
import { WarehousesService } from '../../settings/services/org.service';

/** Khuli stock counts jinhe phone se scan karna hai. */
@Component({
  selector: 'app-scan-counts-page',
  imports: [RouterLink, TranslocoPipe, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-xl space-y-4">
      <div>
        <h1 class="text-xl font-semibold">{{ 'scanApp.counts.title' | transloco }}</h1>
        <p class="text-sm text-slate-600 dark:text-slate-400">{{ 'scanApp.counts.hint' | transloco }}</p>
      </div>

      @if (stale()) {
        <p role="status" class="rounded-xl border border-amber-600 p-3 text-sm text-amber-800 dark:text-amber-400">
          {{ 'scanApp.offlineData' | transloco }}
        </p>
      }
      @if (loading()) {        <p role="status" class="text-sm text-slate-600 dark:text-slate-400">{{ 'common.loading' | transloco }}</p>
      } @else if (error(); as e) {
        <div role="alert" class="space-y-3 rounded-xl border border-red-600 p-4">
          <p class="text-sm text-red-600">{{ e }}</p>
          <button type="button" class="min-h-12 w-full rounded-lg border border-slate-400 px-4 text-sm" (click)="load()">
            {{ 'common.retry' | transloco }}
          </button>
        </div>
      } @else if (items().length === 0) {
        <p class="rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
          {{ 'scanApp.counts.empty' | transloco }}
        </p>
      } @else {
        <ul class="space-y-3">
          @for (c of items(); track c.id) {
            <li>
              <a
                [routerLink]="['/scan/counts', c.id]"
                class="block min-h-20 rounded-xl border border-slate-200 bg-white p-4 shadow-sm active:scale-[0.99] dark:border-slate-700 dark:bg-slate-900"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="font-semibold">{{ c.number }}</span>
                  <app-status-badge [label]="'inventory.counts.status.' + c.status | transloco" [tone]="tone[c.status]" />
                </div>
                <p class="mt-1 text-sm">{{ name(c.warehouseId) }}</p>
                <p class="text-xs text-slate-600 dark:text-slate-400">
                  {{ 'scanApp.counts.expected' | transloco: { n: c.expected.length } }}
                </p>
              </a>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class ScanCountsPage implements OnInit {
  private readonly api = inject(CountsService);
  private readonly whApi = inject(WarehousesService);
  private readonly i18n = inject(TranslocoService);
  private readonly cache = inject(OfflineCacheService);
  protected readonly stale = signal(false);
  protected readonly tone = COUNT_TONE;
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly items = signal<StockCount[]>([]);
  private readonly warehouses = signal<Warehouse[]>([]);
  private readonly names = computed(() => new Map(this.warehouses().map((w) => [w.id, w.name] as [number, string])));

  ngOnInit(): void {
    void this.load();
  }

  protected name(id: number): string {
    return this.names().get(id) ?? '-';
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [all, wh] = await Promise.all([
        this.cache.fetch('counts:list', this.api.list()),
        this.cache.fetch('warehouses:list', this.whApi.list({ pageSize: 500 })),
      ]);
      this.warehouses.set(wh.value.data);
      this.items.set(all.value.filter((c) => c.status === 'open'));
      this.stale.set(all.stale || wh.stale);
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('errors.generic')));
    } finally {
      this.loading.set(false);
    }
  }
}