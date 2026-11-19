import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { HasPermissionDirective } from '../../../core/auth/has-permission.directive';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { formatMoney } from '../../products/utils/product-utils';
import { PurchaseOrder } from '../models/purchase.models';
import { PurchaseService } from '../services/purchase.service';
import { poTotal } from '../utils/purchase-utils';
import { PO_TONE, UI } from '../utils/ui';

@Component({
  selector: 'app-purchase-orders-page',
  imports: [RouterLink, TranslocoPipe, HasPermissionDirective, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">{{ 'purchase.orders.title' | transloco }}</h1>
        <a *hasPermission="'purchase.order.create'" routerLink="new" [class]="ui.primary">+ {{ 'purchase.orders.add' | transloco }}</a>
      </div>
      @if (error(); as e) { <p role="alert" class="text-sm text-red-600">{{ e }}</p> }
      <div [class]="ui.tableWrap">
        <table class="w-full min-w-[48rem] text-start text-sm">
          <thead [class]="ui.thead"><tr>
            <th scope="col" [class]="ui.th">{{ 'purchase.orders.number' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'purchase.orders.supplier' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'purchase.orders.date' | transloco }}</th>
            <th scope="col" [class]="ui.th + ' text-end'">{{ 'purchase.orders.total' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'purchase.orders.received' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'purchase.statusCol' | transloco }}</th>
          </tr></thead>
          <tbody>
            @for (o of rows(); track o.id) {
              <tr [class]="ui.tr">
                <td [class]="ui.td"><a [routerLink]="[o.id]" class="font-medium text-[#1E3A8A] underline dark:text-sky-300">{{ o.number }}</a></td>
                <td [class]="ui.td">{{ o.supplierName }}</td>
                <td [class]="ui.td">{{ o.orderDate }}</td>
                <td [class]="ui.td + ' text-end'">{{ money(total(o)) }}</td>
                <td [class]="ui.td">{{ received(o) }}</td>
                <td [class]="ui.td"><app-status-badge [label]="'purchase.poStatus.' + o.status | transloco" [tone]="tone[o.status]" /></td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="px-4 py-6 text-center text-slate-500">{{ 'common.empty' | transloco }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class PurchaseOrdersPage implements OnInit {
  private readonly api = inject(PurchaseService);
  private readonly i18n = inject(TranslocoService);
  protected readonly ui = UI;
  protected readonly tone = PO_TONE;
  protected readonly money = formatMoney;
  protected readonly rows = signal<PurchaseOrder[]>([]);
  protected readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      this.rows.set(await firstValueFrom(this.api.orders()));
    } catch {
      this.error.set(this.i18n.translate('errors.generic'));
    }
  }

  protected total(o: PurchaseOrder): number {
    return poTotal(o.lines);
  }

  protected received(o: PurchaseOrder): string {
    const got = o.lines.reduce((s, l) => s + l.receivedQty, 0);
    return `${got} / ${o.lines.reduce((s, l) => s + l.qty, 0)}`;
  }
}
