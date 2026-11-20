import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { BadgeTone, StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { formatMoney } from '../../products/utils/product-utils';
import { MatchStatus, PoMatching } from '../models/payables.models';
import { PayablesService } from '../services/payables.service';
import { matchStatus, orderedValue, receivedValue, round2 } from '../utils/payables-utils';
import { UI, errorMessage } from '../utils/ui';

const TONE: Record<MatchStatus, BadgeTone> = {
  matched: 'success',
  mismatch: 'danger',
  no_bill: 'warning',
  not_received: 'neutral',
};

@Component({
  selector: 'app-po-matching-page',
  imports: [RouterLink, TranslocoPipe, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-3">
          <h1 class="text-xl font-semibold">
            {{ 'purchase.payables.matching.title' | transloco: { number: data()?.poNumber ?? '' } }}
          </h1>
          @if (status(); as s) {
            <app-status-badge [label]="'purchase.payables.matching.status.' + s | transloco" [tone]="tone[s]" />
          }
        </div>
        <a [routerLink]="['/purchase/orders', poId]" [class]="ui.btn">{{ 'purchase.orders.back' | transloco }}</a>
      </div>
      <p class="text-sm text-slate-600 dark:text-slate-400">{{ 'purchase.payables.matching.hint' | transloco }}</p>

      @if (notice(); as n) { <p role="status" class="rounded-lg border border-green-600 p-3 text-sm text-green-700">{{ n }}</p> }
      @if (error(); as e) {
        <div role="alert" class="space-y-2 rounded-lg border border-red-600 p-3">
          <p class="text-sm text-red-600">{{ e }}</p>
          <button type="button" [class]="ui.btn" (click)="load()">{{ 'common.retry' | transloco }}</button>
        </div>
      }

      @if (loading()) {
        <p role="status" class="text-sm text-slate-500">{{ 'common.loading' | transloco }}</p>
      } @else if (data(); as m) {
        <div [class]="ui.tableWrap">
          <table class="w-full min-w-[40rem] text-start text-sm">
            <thead [class]="ui.thead"><tr>
              <th scope="col" [class]="ui.th">{{ 'purchase.orders.product' | transloco }}</th>
              <th scope="col" [class]="ui.th + ' text-end'">{{ 'purchase.payables.matching.ordered' | transloco }}</th>
              <th scope="col" [class]="ui.th + ' text-end'">{{ 'purchase.payables.matching.received' | transloco }}</th>
              <th scope="col" [class]="ui.th + ' text-end'">{{ 'purchase.orders.unitCost' | transloco }}</th>
            </tr></thead>
            <tbody>
              @for (l of m.lines; track l.productId) {
                <tr [class]="ui.tr">
                  <td [class]="ui.td">{{ l.name }}</td>
                  <td [class]="ui.td + ' text-end'">{{ l.orderedQty }}</td>
                  <td [class]="ui.td + ' text-end'" [class.text-amber-700]="l.receivedQty < l.orderedQty">{{ l.receivedQty }}</td>
                  <td [class]="ui.td + ' text-end'">{{ money(l.unitCost) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div [class]="ui.card + ' space-y-2'">
          <p class="text-sm">
            {{ 'purchase.payables.matching.grns' | transloco }}:
            @if (m.grnNumbers.length) { <strong>{{ m.grnNumbers.join(', ') }}</strong> } @else { {{ 'purchase.payables.matching.noGrns' | transloco }} }
          </p>
          <dl class="grid gap-2 text-sm sm:grid-cols-4">
            <div><dt class="text-slate-600 dark:text-slate-400">{{ 'purchase.payables.matching.orderedValue' | transloco }}</dt><dd class="font-medium">Rs {{ money(orderedV()) }}</dd></div>
            <div><dt class="text-slate-600 dark:text-slate-400">{{ 'purchase.payables.matching.receivedValue' | transloco }}</dt><dd class="font-medium">Rs {{ money(receivedV()) }}</dd></div>
            <div><dt class="text-slate-600 dark:text-slate-400">{{ 'purchase.payables.matching.billValue' | transloco }}</dt><dd class="font-medium">{{ m.bill ? 'Rs ' + money(m.bill.amount) : '-' }}</dd></div>
            <div><dt class="text-slate-600 dark:text-slate-400">{{ 'purchase.payables.matching.difference' | transloco }}</dt><dd class="font-medium">{{ m.bill ? 'Rs ' + money(diff()) : '-' }}</dd></div>
          </dl>
        </div>

        <div [class]="ui.card + ' space-y-3'">
          <h2 class="text-base font-semibold">{{ 'purchase.payables.matching.billTitle' | transloco }}</h2>
          @if (m.bill; as b) {
            <p class="text-sm">{{ b.number }} · {{ b.billDate }}</p>
          }
          @if (canBill()) {
            <div class="flex flex-wrap items-end gap-3">
              <div class="min-w-40">
                <label for="bill-no" class="mb-1 block text-sm">{{ 'purchase.payables.matching.billNumber' | transloco }}</label>
                <input id="bill-no" dir="ltr" [class]="ui.input" [value]="billNumber()" maxlength="40" (input)="billNumber.set(val($event))" />
              </div>
              <div>
                <label for="bill-date" class="mb-1 block text-sm">{{ 'purchase.payables.matching.billDate' | transloco }}</label>
                <input id="bill-date" type="date" [class]="ui.input" [value]="billDate()" (input)="billDate.set(val($event))" />
              </div>
              <div class="w-40">
                <label for="bill-amount" class="mb-1 block text-sm">{{ 'purchase.payables.matching.billAmount' | transloco }}</label>
                <input id="bill-amount" type="number" min="0" step="0.01" [class]="ui.input" [value]="billAmount()" (input)="billAmount.set(val($event))" />
              </div>
              <button type="button" [class]="ui.primary" [disabled]="busy()" (click)="saveBill()">{{ 'purchase.payables.matching.saveBill' | transloco }}</button>
            </div>
          }
        </div>
      }
    </section>
  `,
})
export class PoMatchingPage implements OnInit {
  private readonly pay = inject(PayablesService);
  private readonly auth = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(TranslocoService);
  protected readonly ui = UI;
  protected readonly tone = TONE;
  protected readonly money = formatMoney;
  protected readonly poId = Number(this.route.snapshot.paramMap.get('id'));

  protected readonly data = signal<PoMatching | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly billNumber = signal('');
  protected readonly billDate = signal(new Date().toISOString().slice(0, 10));
  protected readonly billAmount = signal('');

  protected readonly status = computed(() => {
    const m = this.data();
    return m ? matchStatus(m) : null;
  });
  protected readonly orderedV = computed(() => {
    const m = this.data();
    return m ? orderedValue(m) : 0;
  });
  protected readonly receivedV = computed(() => {
    const m = this.data();
    return m ? receivedValue(m) : 0;
  });
  protected readonly diff = computed(() => {
    const b = this.data()?.bill;
    return b ? round2(b.amount - this.receivedV()) : 0;
  });
  protected readonly canBill = computed(
    () => this.auth.can('purchase.payment.create') && (this.data()?.lines.some((l) => l.receivedQty > 0) ?? false),
  );

  ngOnInit(): void {
    void this.load();
  }

  protected val(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const m = await firstValueFrom(this.pay.matching(this.poId));
      this.data.set(m);
      if (m.bill) {
        this.billNumber.set(m.bill.number);
        this.billDate.set(m.bill.billDate);
        this.billAmount.set(String(m.bill.amount));
      }
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('errors.generic')));
    } finally {
      this.loading.set(false);
    }
  }

  protected async saveBill(): Promise<void> {
    this.error.set(null);
    this.notice.set(null);
    const amount = Number(this.billAmount());
    if (!this.billNumber().trim() || !this.billDate() || !(amount > 0)) {
      this.error.set(this.i18n.translate('purchase.payables.matching.fixBill'));
      return;
    }
    this.busy.set(true);
    try {
      await firstValueFrom(this.pay.saveBill(this.poId, { number: this.billNumber().trim(), billDate: this.billDate(), amount }));
      this.notice.set(this.i18n.translate('purchase.payables.matching.billSaved'));
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('errors.generic')));
    } finally {
      this.busy.set(false);
    }
  }
}