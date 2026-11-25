import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { HasPermissionDirective } from '../../../core/auth/has-permission.directive';
import { SendEmailComponent } from '../../email/ui/send-email.component';
import { PrintService } from '../../../shared/ui/print/print.service';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { PAY_METHODS, PayMethod } from '../../pos/models/pos.models';
import { money, warrantyUntil } from '../../pos/utils/pos-utils';
import { UI, errorMessage } from '../../purchase/utils/ui';
import { Invoice } from '../models/sales.models';
import { SalesService } from '../services/sales.service';
import { newKey, printDoc } from '../utils/sales-print';
import { INVOICE_TONE } from '../utils/sales-utils';

/** Invoice (POS ya wholesale): detail, payments, baqi raqam wasool, print. */
@Component({
  selector: 'app-invoice-page',
  imports: [FormsModule, RouterLink, TranslocoPipe, HasPermissionDirective, StatusBadgeComponent, SendEmailComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-4xl space-y-4">
      @if (error(); as e) { <p role="alert" class="text-sm text-red-600">{{ e }}</p> }
      @if (inv(); as s) {
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h1 class="text-xl font-semibold">{{ 'salesDocs.invoice' | transloco }} {{ s.number }}
            <app-status-badge [label]="'salesDocs.status.invoice.' + s.status | transloco" [tone]="tone[s.status]" /></h1>
          <div class="flex flex-wrap gap-2">
            <a routerLink="/sales/invoices" [class]="ui.btn">{{ 'salesDocs.back' | transloco }}</a>
            <button type="button" [class]="ui.btn" (click)="print(s)">{{ 'salesDocs.print' | transloco }}</button>
            <app-send-email *hasPermission="'email.message.send'" kind="invoice" [refId]="s.id" />
            <a *hasPermission="'sales.return.create'" routerLink="/sales/returns" [class]="ui.btn">{{ 'posPage.returns' | transloco }}</a>
          </div>
        </div>
        <div [class]="ui.card + ' grid gap-2 text-sm sm:grid-cols-4'">
          <div><span class="text-slate-600 dark:text-slate-400">{{ 'salesDocs.customer' | transloco }}</span><br />
            <b>{{ s.customer?.name ?? ('posPage.walkIn' | transloco) }}</b></div>
          <div><span class="text-slate-600 dark:text-slate-400">{{ 'salesDocs.date' | transloco }}</span><br />{{ s.createdAt.slice(0, 10) }}
            · {{ 'salesDocs.channel.' + s.channel | transloco }}</div>
          <div><span class="text-slate-600 dark:text-slate-400">{{ 'salesDocs.dueDate' | transloco }}</span><br />{{ s.dueDate ?? '—' }}</div>
          <div><span class="text-slate-600 dark:text-slate-400">{{ 'salesDocs.challan' | transloco }}</span><br />{{ s.challanNumber ?? '—' }}</div>
        </div>
        <div [class]="ui.tableWrap">
          <table class="w-full text-sm">
            <thead [class]="ui.thead"><tr>
              <th scope="col" [class]="ui.th">{{ 'posPage.item' | transloco }}</th>
              <th scope="col" [class]="ui.th">{{ 'salesDocs.serial' | transloco }}</th>
              <th scope="col" [class]="ui.th + ' text-end'">{{ 'posPage.qty' | transloco }}</th>
              <th scope="col" [class]="ui.th + ' text-end'">{{ 'posPage.price' | transloco }}</th>
              <th scope="col" [class]="ui.th + ' text-end'">{{ 'posPage.amount' | transloco }}</th>
            </tr></thead>
            <tbody>
              @for (l of s.lines; track l.id) {
                <tr [class]="ui.tr">
                  <td [class]="ui.td">{{ l.name }}@if (l.returnedQty) { <span class="text-xs text-amber-700"> · {{ 'salesReturnPage.returned' | transloco }}</span> }</td>
                  <td [class]="ui.td"><code dir="ltr">{{ l.serial ?? '—' }}</code></td>
                  <td [class]="ui.td + ' text-end'">{{ l.qty }}</td>
                  <td [class]="ui.td + ' text-end'">{{ fmt(l.unitPrice) }}</td>
                  <td [class]="ui.td + ' text-end'">{{ fmt(l.qty * l.unitPrice) }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="grid gap-4 md:grid-cols-2">
          <div [class]="ui.card + ' space-y-1 text-sm'">
            <div class="flex justify-between"><span>{{ 'posPage.subtotal' | transloco }}</span><span>{{ fmt(s.subtotal) }}</span></div>
            @if (s.discount) { <div class="flex justify-between"><span>{{ 'posPage.discount' | transloco }}</span><span>-{{ fmt(s.discount) }}</span></div> }
            <div class="flex justify-between font-semibold"><span>{{ 'posPage.total' | transloco }}</span><span>{{ fmt(s.total) }}</span></div>
            <div class="flex justify-between"><span>{{ 'posPage.paid' | transloco }}</span><span>{{ fmt(s.paid - s.change) }}</span></div>
            @if (s.returned) { <div class="flex justify-between"><span>{{ 'salesDocs.returnedAmt' | transloco }}</span><span>{{ fmt(s.returned) }}</span></div> }
            <div class="flex justify-between text-base font-semibold" [class.text-red-600]="s.balance > 0"><span>{{ 'salesDocs.balance' | transloco }}</span><span>{{ fmt(s.balance) }}</span></div>
          </div>
          <div [class]="ui.card + ' text-sm'">
            <h2 class="mb-2 font-semibold">{{ 'salesDocs.payments' | transloco }}</h2>
            <ul class="space-y-1">
              @for (p of s.paymentsDetail; track $index) {
                <li class="flex justify-between gap-2"><span>{{ 'posPage.methods.' + p.method | transloco }} @if (p.reference) { · {{ p.reference }} } · {{ (p.paidAt ?? '').slice(0, 10) }}</span>
                  <span>{{ fmt(p.amount) }}</span></li>
              } @empty { <li class="text-slate-500">{{ 'common.empty' | transloco }}</li> }
              @for (r of s.returns; track r.number) {
                <li class="flex justify-between gap-2 text-amber-700"><span>{{ r.number }} · {{ 'salesDocs.refund.' + r.refundMethod | transloco }}</span><span>{{ fmt(r.amount) }}</span></li>
              }
            </ul>
          </div>
        </div>
        @if (s.balance > 0) {
          <div *hasPermission="'sales.invoice.edit'" [class]="ui.card + ' space-y-2'">
            <h2 class="font-semibold">{{ 'salesDocs.receivePayment' | transloco }}</h2>
            <div class="flex flex-wrap items-end gap-2">
              <label class="text-sm font-medium">{{ 'posPage.amount' | transloco }}
                <input type="number" min="0" [max]="s.balance" [class]="ui.input + ' mt-1 w-40'" [(ngModel)]="amount" /></label>
              <label class="text-sm font-medium">{{ 'posPage.payment' | transloco }}
                <select [class]="ui.input + ' mt-1'" [(ngModel)]="method">
                  @for (m of methods; track m) { <option [ngValue]="m">{{ 'posPage.methods.' + m | transloco }}</option> }
                </select></label>
              <label class="text-sm font-medium">{{ 'salesDocs.reference' | transloco }}
                <input [class]="ui.input + ' mt-1'" [(ngModel)]="reference" /></label>
              <button type="button" [class]="ui.primary" [disabled]="busy() || !(amount > 0) || amount > s.balance" (click)="receive(s)">{{ 'salesDocs.save' | transloco }}</button>
            </div>
            @if (formError(); as e) { <p role="alert" class="text-sm text-red-600">{{ e }}</p> }
          </div>
        }
      }
    </section>
  `,
})
export class InvoicePage implements OnInit {
  private readonly api = inject(SalesService);
  private readonly i18n = inject(TranslocoService);
  private readonly route = inject(ActivatedRoute);
  private readonly printer = inject(PrintService);
  protected readonly ui = UI;
  protected readonly tone = INVOICE_TONE;
  protected readonly methods = PAY_METHODS;
  private readonly id = Number(this.route.snapshot.paramMap.get('id'));
  protected readonly inv = signal<Invoice | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected amount = 0;
  protected method: PayMethod = 'transfer';
  protected reference = '';
  private key = newKey();

  async ngOnInit(): Promise<void> {
    try {
      const s = await firstValueFrom(this.api.invoice(this.id));
      this.inv.set(s);
      this.amount = s.balance;
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('errors.generic')));
    }
  }

  protected fmt(n: number): string {
    return money(n);
  }

  protected async receive(s: Invoice): Promise<void> {
    this.busy.set(true);
    this.formError.set(null);
    try {
      const r = await firstValueFrom(this.api.receivePayment(s.id, { method: this.method, amount: +this.amount, reference: this.reference.trim() || null }, this.key));
      this.inv.set(r);
      this.amount = r.balance;
      this.reference = '';
      this.key = newKey();
    } catch (e) {
      this.formError.set(errorMessage(e, this.i18n.translate('errors.generic')));
    } finally {
      this.busy.set(false);
    }
  }

  protected print(s: Invoice): void {
    const t = (k: string, p?: Record<string, unknown>): string => this.i18n.translate(k, p);
    printDoc(this.printer, this.i18n, {
      titleKey: 'salesDocs.invoice', number: s.number, date: s.createdAt.slice(0, 10), total: s.total,
      party: s.customer ? `${s.customer.name} ${s.customer.phone}` : t('posPage.walkIn'),
      footer: `${t('salesDocs.balance')}: ${money(s.balance)}${s.dueDate ? ` · ${t('salesDocs.dueDate')}: ${s.dueDate}` : ''}`,
      rows: s.lines.map((l) => {
        const w = warrantyUntil(s.createdAt, l.warrantyMonths);
        return { name: l.name, detail: [l.serial ? `S/N ${l.serial}` : l.sku, w ? `${t('posPage.receipt.warranty')}: ${w}` : ''].filter(Boolean).join(' · '),
          qty: l.qty, price: l.unitPrice };
      }),
    });
  }
}
