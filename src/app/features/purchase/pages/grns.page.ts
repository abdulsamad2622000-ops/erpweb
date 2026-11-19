import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { Grn } from '../models/purchase.models';
import { PurchaseService } from '../services/purchase.service';
import { grnLineQty } from '../utils/purchase-utils';
import { UI } from '../utils/ui';

@Component({
  selector: 'app-grns-page',
  imports: [RouterLink, TranslocoPipe, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl space-y-4">
      <h1 class="text-xl font-semibold">{{ 'purchase.grn.title' | transloco }}</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">{{ 'purchase.grn.hint' | transloco }}</p>
      @if (error(); as e) { <p role="alert" class="text-sm text-red-600">{{ e }}</p> }
      <div [class]="ui.tableWrap">
        <table class="w-full min-w-[44rem] text-start text-sm">
          <thead [class]="ui.thead"><tr>
            <th scope="col" [class]="ui.th">GRN</th>
            <th scope="col" [class]="ui.th">PO</th>
            <th scope="col" [class]="ui.th">{{ 'purchase.orders.supplier' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'purchase.grn.items' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'purchase.statusCol' | transloco }}</th>
          </tr></thead>
          <tbody>
            @for (g of rows(); track g.id) {
              <tr [class]="ui.tr">
                <td [class]="ui.td"><a [routerLink]="[g.id]" class="font-medium text-[#1E3A8A] underline dark:text-sky-300">{{ g.number }}</a></td>
                <td [class]="ui.td"><a [routerLink]="['/purchase/orders', g.poId]" class="underline">{{ g.poNumber }}</a></td>
                <td [class]="ui.td">{{ g.supplierName }}</td>
                <td [class]="ui.td">{{ count(g) }}</td>
                <td [class]="ui.td">
                  <app-status-badge [label]="'purchase.grn.status.' + g.status | transloco" [tone]="g.status === 'posted' ? 'success' : 'warning'" />
                </td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="px-4 py-6 text-center text-slate-500">{{ 'purchase.grn.empty' | transloco }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class GrnsPage implements OnInit {
  private readonly api = inject(PurchaseService);
  private readonly i18n = inject(TranslocoService);
  protected readonly ui = UI;
  protected readonly rows = signal<Grn[]>([]);
  protected readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      this.rows.set(await firstValueFrom(this.api.grns()));
    } catch {
      this.error.set(this.i18n.translate('errors.generic'));
    }
  }

  protected count(g: Grn): number {
    return g.lines.reduce((s, l) => s + grnLineQty(l), 0);
  }
}
