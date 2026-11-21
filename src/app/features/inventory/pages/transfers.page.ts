import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { HasPermissionDirective } from '../../../core/auth/has-permission.directive';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { UI } from '../../purchase/utils/ui';
import { Warehouse } from '../../settings/models/org.models';
import { WarehousesService } from '../../settings/services/org.service';
import { Transfer } from '../models/transfer.models';
import { TransfersService } from '../services/transfers.service';
import { TRANSFER_TONE, missingSerials } from '../utils/transfer-utils';

@Component({
  selector: 'app-transfers-page',
  imports: [RouterLink, TranslocoPipe, StatusBadgeComponent, HasPermissionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">{{ 'inventory.transfers.title' | transloco }}</h1>
        <a *hasPermission="'inventory.transfer.create'" routerLink="/inventory/transfers/new" [class]="ui.primary">
          + {{ 'inventory.transfers.add' | transloco }}
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
            <th scope="col" [class]="ui.th">{{ 'inventory.transfers.number' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'inventory.transfers.from' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'inventory.transfers.to' | transloco }}</th>
            <th scope="col" [class]="ui.th + ' text-end'">{{ 'purchase.grn.items' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'purchase.statusCol' | transloco }}</th>
          </tr></thead>
          <tbody>
            @if (loading()) {
              <tr><td colspan="5" class="px-4 py-6 text-center text-slate-500" role="status">{{ 'common.loading' | transloco }}</td></tr>
            } @else {
              @for (t of rows(); track t.id) {
                <tr [class]="ui.tr">
                  <td [class]="ui.td"><a [routerLink]="['/inventory/transfers', t.id]" class="font-medium text-[#1E3A8A] underline dark:text-sky-300">{{ t.number }}</a></td>
                  <td [class]="ui.td">{{ name(t.fromWarehouseId) }}</td>
                  <td [class]="ui.td">{{ name(t.toWarehouseId) }}</td>
                  <td [class]="ui.td + ' text-end'">{{ t.lines.length }}</td>
                  <td [class]="ui.td">
                    <div class="flex flex-wrap items-center gap-2">
                      <app-status-badge [label]="'inventory.transfers.status.' + t.status | transloco" [tone]="tone[t.status]" />
                      @if (missing(t) > 0) {
                        <span class="text-xs font-medium text-red-600">{{ 'inventory.transfers.discrepancyShort' | transloco: { n: missing(t) } }}</span>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="px-4 py-6 text-center text-slate-500">{{ 'inventory.transfers.empty' | transloco }}</td></tr>
              }
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class TransfersPage implements OnInit {
  private readonly api = inject(TransfersService);
  private readonly whApi = inject(WarehousesService);
  private readonly i18n = inject(TranslocoService);
  protected readonly ui = UI;
  protected readonly tone = TRANSFER_TONE;

  protected readonly rows = signal<Transfer[]>([]);
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

  protected missing(t: Transfer): number {
    return missingSerials(t).length;
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