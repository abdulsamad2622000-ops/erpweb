import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { HasPermissionDirective } from '../../../core/auth/has-permission.directive';
import { ConfirmDialogService } from '../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { PrintService } from '../../../shared/ui/print/print.service';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { money } from '../../pos/utils/pos-utils';
import { UI, errorMessage } from '../../purchase/utils/ui';
import { Quotation } from '../models/sales.models';
import { SalesService } from '../services/sales.service';
import { printDoc } from '../utils/sales-print';
import { QUOTATION_TONE } from '../utils/sales-utils';

@Component({
  selector: 'app-quotation-page',
  imports: [RouterLink, TranslocoPipe, HasPermissionDirective, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-5xl space-y-4">
      @if (error(); as e) { <p role="alert" class="text-sm text-red-600">{{ e }}</p> }
      @if (q(); as q) {
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h1 class="text-xl font-semibold">{{ 'salesDocs.quotation' | transloco }} {{ q.number }}
            <app-status-badge [label]="'salesDocs.status.quotation.' + q.status | transloco" [tone]="tone[q.status]" /></h1>
          <div class="flex flex-wrap gap-2">
            <a routerLink="/sales/quotations" [class]="ui.btn">{{ 'salesDocs.back' | transloco }}</a>
            <button type="button" [class]="ui.btn" (click)="print(q)">{{ 'salesDocs.print' | transloco }}</button>
            @if (q.status === 'draft') {
              <a *hasPermission="'sales.quotation.edit'" [routerLink]="['edit']" [class]="ui.btn">{{ 'common.edit' | transloco }}</a>
              <button *hasPermission="'sales.quotation.edit'" type="button" [class]="ui.btn" [disabled]="busy()" (click)="act('send')">{{ 'salesDocs.markSent' | transloco }}</button>
            }
            @if (q.status === 'draft' || q.status === 'sent') {
              <button *hasPermission="'sales.quotation.edit'" type="button" [class]="ui.danger" [disabled]="busy()" (click)="act('cancel')">{{ 'salesDocs.cancel' | transloco }}</button>
              <button *hasPermission="'sales.order.create'" type="button" [class]="ui.primary" [disabled]="busy()" (click)="convert(q)">{{ 'salesDocs.convert' | transloco }}</button>
            }
            @if (q.orderId) {
              <a [routerLink]="['/sales/orders', q.orderId]" [class]="ui.primary">{{ 'salesDocs.openOrder' | transloco }}</a>
            }
          </div>
        </div>
        <div [class]="ui.card + ' grid gap-2 text-sm sm:grid-cols-3'">
          <div><span class="text-slate-600 dark:text-slate-400">{{ 'salesDocs.customer' | transloco }}</span><br /><b>{{ q.customer.name }}</b> <span dir="ltr">{{ q.customer.phone }}</span></div>
          <div><span class="text-slate-600 dark:text-slate-400">{{ 'salesDocs.validUntil' | transloco }}</span><br />{{ q.validUntil ?? '—' }}</div>
          <div><span class="text-slate-600 dark:text-slate-400">{{ 'salesDocs.createdBy' | transloco }}</span><br />{{ q.createdBy }} · {{ q.createdAt.slice(0, 10) }}</div>
          @if (q.note) { <p class="sm:col-span-3">{{ q.note }}</p> }
        </div>
        <div [class]="ui.tableWrap">
          <table class="w-full text-sm">
            <thead [class]="ui.thead"><tr>
              <th scope="col" [class]="ui.th">{{ 'posPage.item' | transloco }}</th>
              <th scope="col" [class]="ui.th + ' text-end'">{{ 'posPage.qty' | transloco }}</th>
              <th scope="col" [class]="ui.th + ' text-end'">{{ 'posPage.price' | transloco }}</th>
              <th scope="col" [class]="ui.th + ' text-end'">{{ 'posPage.amount' | transloco }}</th>
            </tr></thead>
            <tbody>
              @for (l of q.lines; track l.id) {
                <tr [class]="ui.tr"><td [class]="ui.td">{{ l.name }} <span class="text-xs text-slate-500" dir="ltr">{{ l.sku }}</span></td>
                  <td [class]="ui.td + ' text-end'">{{ l.qty }}</td><td [class]="ui.td + ' text-end'">{{ fmt(l.unitPrice) }}</td>
                  <td [class]="ui.td + ' text-end'">{{ fmt(l.amount) }}</td></tr>
              }
            </tbody>
            <tfoot><tr><td colspan="3" class="px-3 py-2 text-end font-semibold">{{ 'posPage.total' | transloco }}</td>
              <td class="px-3 py-2 text-end font-semibold">{{ fmt(q.total) }}</td></tr></tfoot>
          </table>
        </div>
      }
    </section>
  `,
})
export class QuotationPage implements OnInit {
  private readonly api = inject(SalesService);
  private readonly i18n = inject(TranslocoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogs = inject(ConfirmDialogService);
  private readonly printer = inject(PrintService);
  protected readonly ui = UI;
  protected readonly tone = QUOTATION_TONE;
  private readonly id = Number(this.route.snapshot.paramMap.get('id'));
  protected readonly q = signal<Quotation | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  async ngOnInit(): Promise<void> {
    await this.run(async () => this.q.set(await firstValueFrom(this.api.quotation(this.id))));
  }

  protected fmt(n: number): string {
    return money(n);
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await fn();
      this.error.set(null);
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('errors.generic')));
    } finally {
      this.busy.set(false);
    }
  }

  protected async act(a: 'send' | 'cancel'): Promise<void> {
    if (a === 'cancel') {
      const ok = await this.dialogs.confirm({ title: this.i18n.translate('salesDocs.cancel'), message: this.i18n.translate('salesDocs.cancelQuotationMsg'), danger: true });
      if (!ok) return;
    }
    await this.run(async () => this.q.set(await firstValueFrom(this.api.quotationAction(this.id, a))));
  }

  protected async convert(q: Quotation): Promise<void> {
    const ok = await this.dialogs.confirm({ title: this.i18n.translate('salesDocs.convert'),
      message: this.i18n.translate('salesDocs.convertMsg', { number: q.number }) });
    if (!ok) return;
    await this.run(async () => {
      const r = await firstValueFrom(this.api.convert(this.id));
      await this.router.navigate(['/sales/orders', r.order.id]);
    });
  }

  protected print(q: Quotation): void {
    printDoc(this.printer, this.i18n, {
      titleKey: 'salesDocs.quotation', number: q.number, date: q.createdAt.slice(0, 10), total: q.total,
      party: `${q.customer.name} ${q.customer.phone}`,
      footer: q.validUntil ? this.i18n.translate('salesDocs.validUntilLine', { date: q.validUntil }) : '',
      rows: q.lines.map((l) => ({ name: l.name, detail: l.sku, qty: l.qty, price: l.unitPrice })),
    });
  }
}
