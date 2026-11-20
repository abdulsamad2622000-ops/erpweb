import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { formatMoney } from '../../products/utils/product-utils';
import { LandedCostItem } from '../models/payables.models';
import { Grn } from '../models/purchase.models';
import { PayablesService } from '../services/payables.service';
import { PurchaseService } from '../services/purchase.service';
import { allocateLanded, landedTotal } from '../utils/payables-utils';
import { grnLineQty } from '../utils/purchase-utils';
import { UI, errorMessage } from '../utils/ui';

interface BaseLine {
  productId: number;
  name: string;
  qty: number;
  unitCost: number;
}

@Component({
  selector: 'app-grn-landed-cost-page',
  imports: [RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">
          {{ 'purchase.payables.landed.title' | transloco: { number: grn()?.number ?? '' } }}
        </h1>
        <a [routerLink]="['/purchase/grn', grnId]" [class]="ui.btn">{{ 'purchase.payables.landed.back' | transloco }}</a>
      </div>
      <p class="text-sm text-slate-600 dark:text-slate-400">{{ 'purchase.payables.landed.hint' | transloco }}</p>

      @if (notice(); as n) { <p role="status" class="rounded-lg border border-green-600 p-3 text-sm text-green-700">{{ n }}</p> }
      @if (error(); as e) {
        <div role="alert" class="space-y-2 rounded-lg border border-red-600 p-3">
          <p class="text-sm text-red-600">{{ e }}</p>
          <button type="button" [class]="ui.btn" (click)="load()">{{ 'common.retry' | transloco }}</button>
        </div>
      }

      @if (loading()) {
        <p role="status" class="text-sm text-slate-500">{{ 'common.loading' | transloco }}</p>
      } @else if (grn(); as g) {
        @if (g.status !== 'posted') {
          <p class="rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">{{ 'purchase.payables.landed.notPosted' | transloco }}</p>
        }

        <div [class]="ui.card + ' space-y-3'">
          <h2 class="text-base font-semibold">{{ 'purchase.payables.landed.costs' | transloco }}</h2>
          @for (it of items(); track $index; let i = $index) {
            <div class="flex flex-wrap items-end gap-2">
              <div class="min-w-48 flex-1">
                <label [attr.for]="'lc-label-' + i" class="mb-1 block text-sm">{{ 'purchase.payables.landed.label' | transloco }}</label>
                <input [id]="'lc-label-' + i" [class]="ui.input" [value]="it.label" [disabled]="!canEdit()" maxlength="60" (input)="setLabel(i, $event)" />
              </div>
              <div class="w-40">
                <label [attr.for]="'lc-amount-' + i" class="mb-1 block text-sm">{{ 'purchase.payables.amount' | transloco }}</label>
                <input [id]="'lc-amount-' + i" type="number" min="0" step="0.01" [class]="ui.input" [value]="it.amount" [disabled]="!canEdit()" (input)="setAmount(i, $event)" />
              </div>
              @if (canEdit()) {
                <button type="button" class="min-h-11 min-w-11 rounded-lg text-red-600" (click)="remove(i)" [attr.aria-label]="'common.delete' | transloco">✕</button>
              }
            </div>
          } @empty {
            <p class="text-sm text-slate-500">{{ 'purchase.payables.landed.noCosts' | transloco }}</p>
          }
          <div class="flex flex-wrap items-center justify-between gap-3">
            @if (canEdit()) {
              <div class="flex flex-wrap gap-2">
                <button type="button" [class]="ui.btn" (click)="add()">+ {{ 'purchase.payables.landed.add' | transloco }}</button>
                <button type="button" [class]="ui.primary" [disabled]="busy()" (click)="save()">{{ 'common.save' | transloco }}</button>
              </div>
            } @else { <span></span> }
            <p class="text-base font-semibold">{{ 'purchase.payables.landed.totalCosts' | transloco }}: Rs {{ money(total()) }}</p>
          </div>
        </div>

        <div [class]="ui.tableWrap">
          <table class="w-full min-w-[40rem] text-start text-sm">
            <thead [class]="ui.thead"><tr>
              <th scope="col" [class]="ui.th">{{ 'purchase.orders.product' | transloco }}</th>
              <th scope="col" [class]="ui.th + ' text-end'">{{ 'purchase.orders.qty' | transloco }}</th>
              <th scope="col" [class]="ui.th + ' text-end'">{{ 'purchase.payables.landed.goods' | transloco }}</th>
              <th scope="col" [class]="ui.th + ' text-end'">{{ 'purchase.payables.landed.share' | transloco }}</th>
              <th scope="col" [class]="ui.th + ' text-end'">{{ 'purchase.payables.landed.unitLanded' | transloco }}</th>
            </tr></thead>
            <tbody>
              @for (l of allocation(); track l.productId) {
                <tr [class]="ui.tr">
                  <td [class]="ui.td">{{ l.name }}</td>
                  <td [class]="ui.td + ' text-end'">{{ l.qty }}</td>
                  <td [class]="ui.td + ' text-end'">{{ money(l.goodsValue) }}</td>
                  <td [class]="ui.td + ' text-end'">{{ money(l.landedShare) }}</td>
                  <td [class]="ui.td + ' text-end font-medium'">{{ money(l.unitLanded) }}</td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="px-4 py-6 text-center text-slate-500">{{ 'common.empty' | transloco }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>
  `,
})
export class GrnLandedCostPage implements OnInit {
  private readonly api = inject(PurchaseService);
  private readonly pay = inject(PayablesService);
  private readonly auth = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(TranslocoService);
  protected readonly ui = UI;
  protected readonly money = formatMoney;
  protected readonly grnId = Number(this.route.snapshot.paramMap.get('id'));

  protected readonly grn = signal<Grn | null>(null);
  protected readonly items = signal<LandedCostItem[]>([]);
  private readonly base = signal<BaseLine[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  protected readonly allocation = computed(() => allocateLanded(this.base(), this.items()));
  protected readonly total = computed(() => landedTotal(this.items()));
  protected readonly canEdit = computed(() => this.auth.can('purchase.grn.create') && this.grn()?.status === 'posted');

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const g = await firstValueFrom(this.api.grn(this.grnId));
      const [po, lc] = await Promise.all([
        firstValueFrom(this.api.order(g.poId)),
        firstValueFrom(this.pay.landedCost(this.grnId)),
      ]);
      this.grn.set(g);
      this.base.set(
        g.lines.map((l) => ({
          productId: l.productId,
          name: l.name,
          qty: grnLineQty(l),
          unitCost: po.lines.find((x) => x.productId === l.productId)?.unitCost ?? 0,
        })),
      );
      this.items.set(lc.items.map((i) => ({ ...i })));
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('errors.generic')));
    } finally {
      this.loading.set(false);
    }
  }

  protected add(): void {
    this.items.update((l) => [...l, { label: '', amount: 0 }]);
  }

  protected remove(i: number): void {
    this.items.update((l) => l.filter((_, n) => n !== i));
  }

  protected setLabel(i: number, e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    this.items.update((l) => l.map((x, n) => (n === i ? { ...x, label: v } : x)));
  }

  protected setAmount(i: number, e: Event): void {
    const v = Number((e.target as HTMLInputElement).value);
    this.items.update((l) => l.map((x, n) => (n === i ? { ...x, amount: Number.isFinite(v) ? v : 0 } : x)));
  }

  protected async save(): Promise<void> {
    this.error.set(null);
    this.notice.set(null);
    if (this.items().some((i) => !i.label.trim())) {
      this.error.set(this.i18n.translate('purchase.payables.landed.needName'));
      return;
    }
    if (this.items().some((i) => !(i.amount > 0))) {
      this.error.set(this.i18n.translate('purchase.payables.landed.needAmount'));
      return;
    }
    this.busy.set(true);
    try {
      const res = await firstValueFrom(this.pay.saveLandedCost(this.grnId, this.items()));
      this.items.set(res.items.map((i) => ({ ...i })));
      this.notice.set(this.i18n.translate('purchase.payables.landed.saved'));
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('errors.generic')));
    } finally {
      this.busy.set(false);
    }
  }
}