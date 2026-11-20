import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { HasPermissionDirective } from '../../../core/auth/has-permission.directive';
import { formatMoney } from '../../products/utils/product-utils';
import { LedgerEntry } from '../models/payables.models';
import { Supplier } from '../models/purchase.models';
import { PayablesService } from '../services/payables.service';
import { PurchaseService } from '../services/purchase.service';
import { ledgerWithBalance, outstanding } from '../utils/payables-utils';
import { UI } from '../utils/ui';

@Component({
  selector: 'app-supplier-ledger-page',
  imports: [RouterLink, TranslocoPipe, HasPermissionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">
          {{ 'purchase.payables.ledgerTitle' | transloco: { name: supplier()?.name ?? '' } }}
        </h1>
        <div class="flex flex-wrap gap-2">
          <a routerLink="/purchase/suppliers" [class]="ui.btn">{{ 'purchase.payables.back' | transloco }}</a>
          <a *hasPermission="'purchase.payment.create'" routerLink="/purchase/payments"
             [queryParams]="{ supplierId: supplierId }" [class]="ui.primary">
            {{ 'purchase.payables.recordPayment' | transloco }}
          </a>
        </div>
      </div>

      @if (error(); as e) {
        <div role="alert" class="space-y-2 rounded-lg border border-red-600 p-3">
          <p class="text-sm text-red-600">{{ e }}</p>
          <button type="button" [class]="ui.btn" (click)="load()">{{ 'common.retry' | transloco }}</button>
        </div>
      } @else if (loading()) {
        <p role="status" class="text-sm text-slate-500">{{ 'common.loading' | transloco }}</p>
      } @else {
        <div [class]="ui.card">
          <p class="text-sm text-slate-600 dark:text-slate-400">{{ 'purchase.payables.owed' | transloco }}</p>
          <p class="text-2xl font-semibold">Rs {{ money(owed()) }}</p>
        </div>

        <div [class]="ui.tableWrap">
          <table class="w-full min-w-[40rem] text-start text-sm">
            <thead [class]="ui.thead"><tr>
              <th scope="col" [class]="ui.th">{{ 'purchase.payables.date' | transloco }}</th>
              <th scope="col" [class]="ui.th">{{ 'purchase.payables.type' | transloco }}</th>
              <th scope="col" [class]="ui.th">{{ 'purchase.payables.ref' | transloco }}</th>
              <th scope="col" [class]="ui.th + ' text-end'">{{ 'purchase.payables.increase' | transloco }}</th>
              <th scope="col" [class]="ui.th + ' text-end'">{{ 'purchase.payables.decrease' | transloco }}</th>
              <th scope="col" [class]="ui.th + ' text-end'">{{ 'purchase.payables.balance' | transloco }}</th>
            </tr></thead>
            <tbody>
              @for (r of rows(); track r.id) {
                <tr [class]="ui.tr">
                  <td [class]="ui.td">{{ r.date }}</td>
                  <td [class]="ui.td">{{ 'purchase.payables.types.' + r.type | transloco }}</td>
                  <td [class]="ui.td">{{ r.ref }}</td>
                  <td [class]="ui.td + ' text-end'">{{ r.increase ? money(r.increase) : '-' }}</td>
                  <td [class]="ui.td + ' text-end'">{{ r.decrease ? money(r.decrease) : '-' }}</td>
                  <td [class]="ui.td + ' text-end font-medium'">{{ money(r.balance) }}</td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="px-4 py-6 text-center text-slate-500">{{ 'purchase.payables.noEntries' | transloco }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class SupplierLedgerPage implements OnInit {
  private readonly api = inject(PurchaseService);
  private readonly pay = inject(PayablesService);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(TranslocoService);
  protected readonly ui = UI;
  protected readonly money = formatMoney;
  protected readonly supplierId = Number(this.route.snapshot.paramMap.get('id'));

  protected readonly supplier = signal<Supplier | null>(null);
  protected readonly entries = signal<LedgerEntry[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly rows = computed(() => ledgerWithBalance(this.entries()));
  protected readonly owed = computed(() => outstanding(this.entries()));

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [s, l] = await Promise.all([
        firstValueFrom(this.api.suppliers()),
        firstValueFrom(this.pay.ledger(this.supplierId)),
      ]);
      this.supplier.set(s.data.find((x) => x.id === this.supplierId) ?? null);
      this.entries.set(l.entries);
    } catch {
      this.error.set(this.i18n.translate('errors.generic'));
    } finally {
      this.loading.set(false);
    }
  }
}