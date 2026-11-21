import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { HasPermissionDirective } from '../../../core/auth/has-permission.directive';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { UI } from '../../purchase/utils/ui';
import { Warehouse } from '../../settings/models/org.models';
import { WarehousesService } from '../../settings/services/org.service';
import { StockCount } from '../models/count.models';
import { CountsService } from '../services/counts.service';
import { COUNT_TONE, variance } from '../utils/count-utils';

@Component({
  selector: 'app-counts-page',
  imports: [RouterLink, TranslocoPipe, StatusBadgeComponent, HasPermissionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">{{ 'inventory.counts.title' | transloco }}</h1>
        <a *hasPermission="'inventory.count.create'" routerLink="/inventory/counts/new" [class]="ui.primary">
          + {{ 'inventory.counts.add' | transloco }}
        </a>
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
            <th scope="col" [class]="ui.th">{{ 'inventory.counts.number' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'inventory.counts.warehouse' | transloco }}</th>
            <th scope="col" [class]="ui.th + ' text-end'">{{ 'inventory.counts.expected' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'purchase.statusCol' | transloco }}</th>
          </tr></thead>
          <tbody>
            @if (loading()) {
              <tr><td colspan="4" class="px-4 py-6 text-center text-slate-500" role="status">{{ 'common.loading' | transloco }}</td></tr>
            } @else {
              @for (c of rows(); track c.id) {
                <tr [class]="ui.tr">
                  <td [class]="ui.td"><a [routerLink]="['/inventory/counts', c.id]" class="font-medium text-[#1E3A8A] underline dark:text-sky-300">{{ c.number }}</a></td>
                  <td [class]="ui.td">{{ name(c.warehouseId) }}</td>
                  <td [class]="ui.td + ' text-end'">{{ c.expected.length }}</td>
                  <td [class]="ui.td">
                    <div class="flex flex-wrap items-center gap-2">
                      <app-status-badge [label]="'inventory.counts.status.' + c.status | transloco" [tone]="tone[c.status]" />
                      @if (c.status !== 'open') {
                        @if (diff(c).missing > 0) {
                          <span class="text-xs font-medium text-red-600">{{ 'inventory.counts.missingShort' | transloco: { n: diff(c).missing } }}</span>
                        }
                        @if (diff(c).extra > 0) {
                          <span class="text-xs font-medium text-amber-700">{{ 'inventory.counts.extraShort' | transloco: { n: diff(c).extra } }}</span>
                        }
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="4" class="px-4 py-6 text-center text-slate-500">{{ 'inventory.counts.empty' | transloco }}</td></tr>
              }
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class CountsPage implements OnInit {
  private readonly api = inject(CountsService);
  private readonly whApi = inject(WarehousesService);
  private readonly i18n = inject(TranslocoService);
  protected readonly ui = UI;
  protected readonly tone = COUNT_TONE;

  protected readonly rows = signal<StockCount[]>([]);
  protected readonly warehouses = signal<Warehouse[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  private readonly names = computed(() => new Map(this.warehouses().map((w) => [w.id, w.name] as [number, string])));

  ngOnInit(): void {
    void this.init();
  }

  protected name(id: number): string {
    return this.names().get(id) ?? '-';
  }

  protected diff(c: StockCount): { missing: number; extra: number } {
    const v = variance(c);
    return { missing: v.missing.length, extra: v.extra.length };
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
      this.rows.set(await firstValueFrom(this.api.list()));
    } catch {
      this.error.set(this.i18n.translate('errors.generic'));
    } finally {
      this.loading.set(false);
    }
  }
}