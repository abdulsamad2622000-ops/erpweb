import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { ScanEvent, ScanInputComponent } from '../../../shared/ui/scan-input/scan-input.component';
import { UI, errorMessage } from '../../purchase/utils/ui';
import { PAY_METHODS, RefundMethod, ReturnResult, Sale, SaleLine } from '../models/pos.models';
import { PosService } from '../services/pos.service';
import { HasPermissionDirective } from '../../../core/auth/has-permission.directive';
import { money, refundFor } from '../utils/pos-utils';

/** Step 12: receipt number ya serial scan kar ke return / exchange. Serial wapas stock mein. */
@Component({
  selector: 'app-sales-return-page',
  imports: [FormsModule, RouterLink, TranslocoPipe, ScanInputComponent, HasPermissionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-3xl space-y-4 p-1">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">{{ 'salesReturnPage.title' | transloco }}</h1>
        <a routerLink="/sales/pos" [class]="ui.btn">{{ 'salesReturnPage.back' | transloco }}</a>
      </div>

      <div [class]="ui.card + ' space-y-2'">
        <label for="sr-scan" class="block text-sm font-medium">{{ 'salesReturnPage.find' | transloco }}</label>
        <app-scan-input inputId="sr-scan" [placeholder]="'salesReturnPage.findHint' | transloco" (scanned)="find($event)" />
        @if (error(); as e) {
          <p role="alert" class="text-sm text-red-600">{{ e }}</p>
        }
      </div>

      @if (done(); as d) {
        <div role="status" class="rounded-xl border border-green-600 p-4 text-sm">
          {{ 'salesReturnPage.done' | transloco: { number: d.number, amount: fmt(d.amount) } }}
          {{ 'salesDocs.refund.' + d.refundMethod | transloco }}.
          <p class="mt-1">{{ 'salesReturnPage.exchangeHint' | transloco }}</p>
        </div>
      }

      @if (sale(); as s) {
        <div [class]="ui.card + ' space-y-3'">
          <div class="flex flex-wrap justify-between gap-2 text-sm">
            <span><b>{{ s.number }}</b> · {{ s.createdAt.slice(0, 10) }} · {{ s.cashier }}</span>
            <span>{{ 'posPage.total' | transloco }}: {{ fmt(s.total) }}</span>
          </div>
          <fieldset class="space-y-1">
            <legend class="mb-1 text-sm font-medium">{{ 'salesReturnPage.pick' | transloco }}</legend>
            @for (l of s.lines; track l.id) {
              <label class="flex min-h-11 items-center gap-3 rounded border border-slate-200 px-3 text-sm dark:border-slate-700"
                [class.opacity-50]="left(l) === 0">
                <input type="checkbox" class="h-5 w-5" [disabled]="left(l) === 0" [checked]="picked().has(l.id)" (change)="toggle(l)" />
                <span class="flex-1">
                  {{ l.name }}
                  @if (l.serial) { · <code dir="ltr">{{ l.serial }}</code> }
                  @if (left(l) === 0) { · {{ 'salesReturnPage.returned' | transloco }} }
                </span>
                <span>{{ fmt(l.unitPrice) }}</span>
              </label>
            }
          </fieldset>
          <label for="sr-method" class="block text-sm font-medium">{{ 'salesReturnPage.refund' | transloco }}</label>
          <select id="sr-method" [class]="ui.input" [(ngModel)]="method">
            @for (m of methods; track m) {
              <option [ngValue]="m">{{ 'posPage.methods.' + m | transloco }}</option>
            }
            @if (s.customer) {
              <option ngValue="credit">{{ 'salesDocs.refund.credit' | transloco }}</option>
            }
          </select>
          <label for="sr-reason" class="block text-sm font-medium">{{ 'salesReturnPage.reason' | transloco }}</label>
          <textarea id="sr-reason" rows="2" [class]="ui.input + ' py-2'" [(ngModel)]="reason"></textarea>
          <p class="text-xs text-slate-600 dark:text-slate-400">{{ 'salesReturnPage.reasonHint' | transloco }}</p>
          <div class="flex items-center justify-between">
            <span class="text-base font-semibold">{{ 'salesReturnPage.amount' | transloco }}: {{ fmt(amount()) }}</span>
            <button *hasPermission="'sales.return.create'" type="button" [class]="ui.primary" [disabled]="!picked().size || reason.trim().length < 10 || busy()" (click)="submit(s)">
              {{ 'salesReturnPage.submit' | transloco }}
            </button>
          </div>
        </div>
      }
    </section>
  `,
})
export class SalesReturnPage {
  private readonly api = inject(PosService);
  private readonly i18n = inject(TranslocoService);
  protected readonly ui = UI;
  protected readonly methods = PAY_METHODS;

  protected readonly sale = signal<Sale | null>(null);
  protected readonly picked = signal<Set<number>>(new Set());
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly done = signal<ReturnResult | null>(null);
  protected method: RefundMethod = 'cash';
  protected reason = '';

  protected readonly amount = computed(() => {
    const s = this.sale();
    return s ? refundFor(s, [...this.picked()].map((id) => ({ saleLineId: id, qty: this.qtyOf(s, id) }))) : 0;
  });

  protected fmt(n: number): string {
    return money(n);
  }

  protected left(l: SaleLine): number {
    return l.qty - l.returnedQty;
  }

  private qtyOf(s: Sale, id: number): number {
    const l = s.lines.find((x) => x.id === id);
    return l ? this.left(l) : 0;
  }

  protected async find(e: ScanEvent): Promise<void> {
    this.error.set(null);
    this.done.set(null);
    try {
      const s = await firstValueFrom(this.api.findSale(e.value));
      this.sale.set(s);
      this.method = s.customer && s.channel === 'wholesale' ? 'credit' : 'cash';
      const code = e.value.trim().toUpperCase();
      const hit = s.lines.find((l) => l.serial === code && this.left(l) > 0);
      this.picked.set(new Set(hit ? [hit.id] : []));
    } catch (err) {
      this.sale.set(null);
      this.error.set(errorMessage(err, this.i18n.translate('errors.generic')));
    }
  }

  protected toggle(l: SaleLine): void {
    this.picked.update((p) => {
      const n = new Set(p);
      if (n.has(l.id)) n.delete(l.id);
      else n.add(l.id);
      return n;
    });
  }

  protected async submit(s: Sale): Promise<void> {
    this.error.set(null);
    this.busy.set(true);
    try {
      const r = await firstValueFrom(
        this.api.returnItems({
          saleId: s.id,
          lines: [...this.picked()].map((id) => ({ saleLineId: id, qty: this.qtyOf(s, id) })),
          refundMethod: this.method,
          reason: this.reason.trim(),
        }),
      );
      this.done.set(r);
      this.sale.set(r.sale);
      this.picked.set(new Set());
      this.reason = '';
    } catch (err) {
      this.error.set(errorMessage(err, this.i18n.translate('errors.generic')));
    } finally {
      this.busy.set(false);
    }
  }
}
