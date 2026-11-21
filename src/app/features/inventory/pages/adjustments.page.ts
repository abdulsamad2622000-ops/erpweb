import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { HasPermissionDirective } from '../../../core/auth/has-permission.directive';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { UI } from '../../purchase/utils/ui';
import { StockAdjustment } from '../models/adjustment.models';
import { AdjustmentsService } from '../services/adjustments.service';
import { ADJUSTMENT_TONE } from '../utils/adjustment-utils';

@Component({
  selector: 'app-adjustments-page',
  imports: [RouterLink, TranslocoPipe, StatusBadgeComponent, HasPermissionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">{{ 'inventory.adjustments.title' | transloco }}</h1>
        <a *hasPermission="'inventory.adjustment.create'" routerLink="/inventory/adjustments/new" [class]="ui.primary">
          + {{ 'inventory.adjustments.add' | transloco }}
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
            <th scope="col" [class]="ui.th">{{ 'inventory.adjustments.number' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'inventory.adjustments.kind' | transloco }}</th>
            <th scope="col" [class]="ui.th + ' text-end'">{{ 'inventory.adjustments.serialsCount' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'inventory.transfers.createdBy' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'purchase.statusCol' | transloco }}</th>
          </tr></thead>
          <tbody>
            @if (loading()) {
              <tr><td colspan="5" class="px-4 py-6 text-center text-slate-500" role="status">{{ 'common.loading' | transloco }}</td></tr>
            } @else {
              @for (a of rows(); track a.id) {
                <tr [class]="ui.tr">
                  <td [class]="ui.td"><a [routerLink]="['/inventory/adjustments', a.id]" class="font-medium text-[#1E3A8A] underline dark:text-sky-300">{{ a.number }}</a></td>
                  <td [class]="ui.td">{{ 'inventory.adjustments.kinds.' + a.kind | transloco }}</td>
                  <td [class]="ui.td + ' text-end'">{{ a.lines.length }}</td>
                  <td [class]="ui.td">{{ a.createdBy }}</td>
                  <td [class]="ui.td"><app-status-badge [label]="'inventory.adjustments.status.' + a.status | transloco" [tone]="tone[a.status]" /></td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="px-4 py-6 text-center text-slate-500">{{ 'inventory.adjustments.empty' | transloco }}</td></tr>
              }
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class AdjustmentsPage implements OnInit {
  private readonly api = inject(AdjustmentsService);
  private readonly i18n = inject(TranslocoService);
  protected readonly ui = UI;
  protected readonly tone = ADJUSTMENT_TONE;

  protected readonly rows = signal<StockAdjustment[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    void this.load();
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