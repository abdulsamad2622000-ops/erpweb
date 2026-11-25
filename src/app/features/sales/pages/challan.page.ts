import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { HasPermissionDirective } from '../../../core/auth/has-permission.directive';
import { PrintService } from '../../../shared/ui/print/print.service';
import { PAY_METHODS, PayMethod } from '../../pos/models/pos.models';
import { money, round2 } from '../../pos/utils/pos-utils';
import { UI, errorMessage } from '../../purchase/utils/ui';
import { Challan, SalesOrder, WholesaleCustomer } from '../models/sales.models';
import { SalesService } from '../services/sales.service';
import { newKey, printDoc } from '../utils/sales-print';
import { creditCheck } from '../utils/sales-utils';

/** Delivery challan: detail, print (bina price), aur invoice banana (credit check ke saath). */
@Component({
  selector: 'app-challan-page',
  imports: [FormsModule, RouterLink, TranslocoPipe, HasPermissionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-4xl space-y-4">
      @if (error(); as e) { <p role="alert" class="text-sm text-red-600">{{ e }}</p> }
      @if (c(); as c) {
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h1 class="text-xl font-semibold">{{ 'salesDocs.challan' | transloco }} {{ c.number }}</h1>
          <div class="flex flex-wrap gap-2">
            <a routerLink="/sales/challans" [class]="ui.btn">{{ 'salesDocs.back' | transloco }}</a>
            <button type="button" [class]="ui.btn" (click)="print(c)">{{ 'salesDocs.print' | transloco }}</button>
            @if (c.invoiceId) {
              <a [routerLink]="['/sales/invoices', c.invoiceId]" [class]="ui.primary">{{ 'salesDocs.openInvoice' | transloco }} {{ c.invoiceNumber }}</a>
            }
          </div>
        </div>
        <div [class]="ui.card + ' grid gap-2 text-sm sm:grid-cols-3'">
          <div><span class="text-slate-600 dark:text-slate-400">{{ 'salesDocs.customer' | transloco }}</span><br /><b>{{ c.customer.name }}</b> <span dir="ltr">{{ c.customer.phone }}</span></div>
          <div><span class="text-slate-600 dark:text-slate-400">{{ 'salesDocs.order' | transloco }}</span><br />
            <a [routerLink]="['/sales/orders', c.orderId]" class="text-[#1E3A8A] underline dark:text-sky-300">{{ c.orderNumber }}</a></div>
          <div><span class="text-slate-600 dark:text-slate-400">{{ 'salesDocs.fromWarehouse' | transloco }}</span><br />{{ c.warehouseName }} · {{ c.createdAt.slice(0, 10) }}</div>
        </div>
        <div [class]="ui.tableWrap">
          <table class="w-full text-sm">
            <thead [class]="ui.thead"><tr>
              <th scope="col" [class]="ui.th">{{ 'posPage.item' | transloco }}</th>
              <th scope="col" [class]="ui.th">{{ 'salesDocs.serial' | transloco }}</th>
              <th scope="col" [class]="ui.th + ' text-end'">{{ 'posPage.qty' | transloco }}</th>
            </tr></thead>
            <tbody>
              @for (l of c.lines; track l.id) {
                <tr [class]="ui.tr"><td [class]="ui.td">{{ l.name }}</td><td [class]="ui.td"><code dir="ltr">{{ l.serial ?? '—' }}</code></td>
                  <td [class]="ui.td + ' text-end'">{{ l.qty }}</td></tr>
              }
            </tbody>
          </table>
        </div>

        @if (!c.invoiceId) {
          <div *hasPermission="'sales.invoice.create'" [class]="ui.card + ' space-y-3'">
            <h2 class="font-semibold">{{ 'salesDocs.makeInvoice' | transloco }}</h2>
            <div class="grid gap-2 text-sm sm:grid-cols-3">
              <div>{{ 'salesDocs.invoiceTotal' | transloco }}<br /><b class="text-base">{{ fmt(total()) }}</b></div>
              <div>{{ 'customersPage.balance' | transloco }}<br /><b>{{ fmt(cust()?.balance ?? 0) }}</b></div>
              <div>{{ 'customersPage.creditLimit' | transloco }}<br /><b>{{ (cust()?.creditLimit ?? 0) ? fmt(cust()!.creditLimit) : ('customersPage.cashOnly' | transloco) }}</b></div>
            </div>
            <div class="flex flex-wrap items-end gap-2">
              <label class="text-sm font-medium">{{ 'salesDocs.paidNow' | transloco }}
                <input placeholder="Type here..." type="number" min="0" [class]="ui.input + ' mt-1 w-40'" [(ngModel)]="payNow" /></label>
              <label class="text-sm font-medium">{{ 'posPage.payment' | transloco }}
                <select [class]="ui.input + ' mt-1'" [(ngModel)]="method">
                  @for (m of methods; track m) { <option [ngValue]="m">{{ 'posPage.methods.' + m | transloco }}</option> }
                </select></label>
              <label class="text-sm font-medium">{{ 'salesDocs.reference' | transloco }}
                <input placeholder="Type here..." [class]="ui.input + ' mt-1'" [(ngModel)]="reference" /></label>
            </div>
            @if (credit(); as cr) {
              <p class="text-sm" [class.text-red-600]="!cr.allowed">
                {{ (cr.credit ? (cr.allowed ? 'salesDocs.onCredit' : 'salesDocs.overCredit') : 'salesDocs.fullyPaid') | transloco: { n: fmt(cr.credit) } }}
              </p>
            }
            @if (formError(); as e) { <p role="alert" class="text-sm text-red-600">{{ e }}</p> }
            <div class="flex justify-end">
              <button type="button" [class]="ui.primary" [disabled]="busy() || !credit().allowed" (click)="invoice(c)">{{ 'salesDocs.createInvoice' | transloco }}</button>
            </div>
          </div>
        }
      }
    </section>
  `,
})
export class ChallanPage implements OnInit {
  private readonly api = inject(SalesService);
  private readonly i18n = inject(TranslocoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly printer = inject(PrintService);
  protected readonly ui = UI;
  protected readonly methods = PAY_METHODS;
  private readonly id = Number(this.route.snapshot.paramMap.get('id'));
  protected readonly c = signal<Challan | null>(null);
  protected readonly order = signal<SalesOrder | null>(null);
  protected readonly cust = signal<WholesaleCustomer | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly payNowSig = signal(0);
  protected method: PayMethod = 'cash';
  protected reference = '';
  private readonly key = newKey();

  protected get payNow(): number {
    return this.payNowSig();
  }
  protected set payNow(v: number) {
    this.payNowSig.set(Math.max(0, +v || 0));
  }

  protected readonly total = computed(() => {
    const c = this.c();
    const o = this.order();
    if (!c || !o) return 0;
    return round2(c.lines.reduce((a, l) => a + l.qty * (o.lines.find((x) => x.id === l.orderLineId)?.unitPrice ?? 0), 0));
  });
  protected readonly credit = computed(() =>
    creditCheck(this.total(), this.payNowSig(), this.cust()?.balance ?? 0, this.cust()?.creditLimit ?? 0),
  );

  async ngOnInit(): Promise<void> {
    try {
      const c = await firstValueFrom(this.api.challan(this.id));
      this.c.set(c);
      if (!c.invoiceId) {
        const [o, cu] = await Promise.all([firstValueFrom(this.api.order(c.orderId)), firstValueFrom(this.api.customer(c.customer.id))]);
        this.order.set(o);
        this.cust.set(cu);
      }
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('errors.generic')));
    }
  }

  protected fmt(n: number): string {
    return money(n);
  }

  protected async invoice(c: Challan): Promise<void> {
    this.busy.set(true);
    this.formError.set(null);
    try {
      const pay = this.payNowSig() > 0 ? [{ method: this.method, amount: this.payNowSig(), reference: this.reference.trim() || null }] : [];
      const inv = await firstValueFrom(this.api.createInvoice(c.id, pay, this.key));
      await this.router.navigate(['/sales/invoices', inv.id]);
    } catch (e) {
      this.formError.set(errorMessage(e, this.i18n.translate('errors.generic')));
    } finally {
      this.busy.set(false);
    }
  }

  protected print(c: Challan): void {
    printDoc(this.printer, this.i18n, {
      titleKey: 'salesDocs.challan', number: c.number, date: c.createdAt.slice(0, 10), total: null,
      party: `${c.customer.name} ${c.customer.phone} · ${c.orderNumber}`, footer: this.i18n.translate('salesDocs.receivedBy'),
      rows: c.lines.map((l) => ({ name: l.name, detail: l.serial ? `S/N ${l.serial}` : l.sku, qty: l.qty, price: null })),
    });
  }
}
