import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Observable, firstValueFrom } from 'rxjs';
import { HasPermissionDirective } from '../../../core/auth/has-permission.directive';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { money } from '../../pos/utils/pos-utils';
import { UI, errorMessage } from '../../purchase/utils/ui';
import { Paged, SalesService } from '../services/sales.service';
import { INVOICE_TONE, ORDER_TONE, QUOTATION_TONE } from '../utils/sales-utils';

export type SalesListKind = 'quotations' | 'orders' | 'challans' | 'invoices';

interface Row {
  id: number;
  number: string;
  party: string;
  date: string;
  amount: number | null;
  extra: string;
  status: string;
  statusKey: string;
  tone: 'success' | 'neutral' | 'warning' | 'danger' | 'info';
}

const STATUSES: Record<SalesListKind, string[]> = {
  quotations: ['draft', 'sent', 'accepted', 'cancelled'],
  orders: ['open', 'partial', 'delivered', 'cancelled'],
  challans: ['false', 'true'],
  invoices: ['unpaid'],
};
const CREATE: Partial<Record<SalesListKind, string>> = { quotations: 'sales.quotation.create', orders: 'sales.order.create' };

/** Step 11: quotations / orders / challans / invoices ki ek hi list (route data `kind`). */
@Component({
  selector: 'app-sales-list-page',
  imports: [FormsModule, RouterLink, TranslocoPipe, HasPermissionDirective, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">{{ 'salesDocs.' + kind + '.title' | transloco }}</h1>
        @if (createPerm) {
          <a *hasPermission="createPerm" routerLink="new" [class]="ui.primary">+ {{ 'salesDocs.' + kind + '.add' | transloco }}</a>
        }
      </div>
      <div class="flex flex-wrap gap-2">
        <input #q [class]="ui.input + ' max-w-xs'" [attr.aria-label]="'common.search' | transloco"
          [placeholder]="'salesDocs.searchHint' | transloco" (input)="search(q.value)" />
        <select [class]="ui.input + ' max-w-56'" [attr.aria-label]="'common.status' | transloco" [(ngModel)]="filter" (ngModelChange)="reload()">
          <option value="">{{ 'salesDocs.all' | transloco }}</option>
          @for (s of statuses; track s) { <option [value]="s">{{ 'salesDocs.filter.' + kind + '.' + s | transloco }}</option> }
        </select>
        @if (customerId) {
          <a [routerLink]="[]" [class]="ui.btn">{{ 'salesDocs.clearCustomer' | transloco }}</a>
        }
      </div>
      @if (error(); as e) { <p role="alert" class="text-sm text-red-600">{{ e }}</p> }
      <div [class]="ui.tableWrap">
        <table class="w-full min-w-[48rem] text-sm">
          <thead [class]="ui.thead"><tr>
            <th scope="col" [class]="ui.th">{{ 'salesDocs.number' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'salesDocs.customer' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'salesDocs.date' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'salesDocs.' + kind + '.extra' | transloco }}</th>
            <th scope="col" [class]="ui.th + ' text-end'">{{ 'salesDocs.' + kind + '.amount' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'common.status' | transloco }}</th>
          </tr></thead>
          <tbody>
            @for (r of rows(); track r.id) {
              <tr [class]="ui.tr">
                <td [class]="ui.td"><a [routerLink]="[r.id]" class="font-medium text-[#1E3A8A] underline dark:text-sky-300">{{ r.number }}</a></td>
                <td [class]="ui.td">{{ r.party }}</td>
                <td [class]="ui.td">{{ r.date }}</td>
                <td [class]="ui.td">{{ r.extra }}</td>
                <td [class]="ui.td + ' text-end'">{{ r.amount === null ? '' : fmt(r.amount) }}</td>
                <td [class]="ui.td"><app-status-badge [label]="r.statusKey | transloco" [tone]="r.tone" /></td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="px-4 py-6 text-center text-slate-500">{{ 'common.empty' | transloco }}</td></tr>
            }
          </tbody>
        </table>
      </div>
      @if (total() > rows().length) {
        <div class="flex justify-center">
          <button type="button" [class]="ui.btn" (click)="more()">{{ 'salesDocs.more' | transloco }} ({{ rows().length }} / {{ total() }})</button>
        </div>
      }
    </section>
  `,
})
export class SalesListPage implements OnInit {
  private readonly api = inject(SalesService);
  private readonly i18n = inject(TranslocoService);
  private readonly route = inject(ActivatedRoute);
  protected readonly ui = UI;
  protected readonly kind = (this.route.snapshot.data['kind'] ?? 'quotations') as SalesListKind;
  protected readonly statuses = STATUSES[this.kind];
  protected readonly createPerm = CREATE[this.kind] ?? null;
  protected readonly customerId = this.route.snapshot.queryParamMap.get('customerId');
  protected readonly rows = signal<Row[]>([]);
  protected readonly total = signal(0);
  protected readonly error = signal<string | null>(null);
  protected filter = '';
  private text = '';
  private page = 1;
  private timer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    void this.reload();
  }

  protected fmt(n: number): string {
    return money(n);
  }

  protected search(v: string): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.text = v.trim();
      void this.reload();
    }, 250);
  }

  protected async reload(): Promise<void> {
    this.page = 1;
    this.rows.set([]);
    await this.fetch();
  }

  protected async more(): Promise<void> {
    this.page++;
    await this.fetch();
  }

  private async fetch(): Promise<void> {
    const base = { page: this.page, pageSize: 20, search: this.text };
    const date = (s: string): string => s.slice(0, 10);
    const t = (k: string): string => this.i18n.translate(k);
    try {
      let res: Paged<Row>;
      if (this.kind === 'quotations') {
        res = await this.map(this.api.quotations({ ...base, status: this.filter }), (q) => ({
          id: q.id, number: q.number, party: q.customer.name, date: date(q.createdAt), amount: q.total,
          extra: q.validUntil ?? '', status: q.status, statusKey: `salesDocs.status.quotation.${q.status}`, tone: QUOTATION_TONE[q.status],
        }));
      } else if (this.kind === 'orders') {
        res = await this.map(this.api.orders({ ...base, status: this.filter }), (o) => ({
          id: o.id, number: o.number, party: o.customer.name, date: date(o.createdAt), amount: o.total,
          extra: `${o.lines.reduce((a, l) => a + l.deliveredQty, 0)} / ${o.lines.reduce((a, l) => a + l.qty, 0)}`,
          status: o.status, statusKey: `salesDocs.status.order.${o.status}`, tone: ORDER_TONE[o.status],
        }));
      } else if (this.kind === 'challans') {
        res = await this.map(this.api.challans({ ...base, invoiced: this.filter }), (c) => ({
          id: c.id, number: c.number, party: c.customer.name, date: date(c.createdAt), amount: null,
          extra: `${c.orderNumber} · ${c.lines.reduce((a, l) => a + l.qty, 0)} ${t('salesDocs.items')}`,
          status: c.invoiceId ? 'invoiced' : 'pending', statusKey: c.invoiceId ? 'salesDocs.status.challan.invoiced' : 'salesDocs.status.challan.pending',
          tone: c.invoiceId ? 'success' : 'warning',
        }));
      } else {
        res = await this.map(this.api.invoices({ ...base, unpaid: this.filter === 'unpaid' ? true : null, customerId: this.customerId }), (s) => ({
          id: s.id, number: s.number, party: s.customer?.name ?? t('posPage.walkIn'), date: date(s.createdAt), amount: s.total,
          extra: s.balance > 0 ? `${t('salesDocs.balance')}: ${money(s.balance)}` : t(`salesDocs.channel.${s.channel}`),
          status: s.status, statusKey: `salesDocs.status.invoice.${s.status}`, tone: INVOICE_TONE[s.status],
        }));
      }
      this.rows.update((r) => [...r, ...res.data]);
      this.total.set(res.total);
      this.error.set(null);
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('errors.generic')));
    }
  }

  private async map<T>(src: Observable<Paged<T>>, fn: (x: T) => Row): Promise<Paged<Row>> {
    const r = await firstValueFrom(src);
    return { data: r.data.map(fn), total: r.total };
  }
}
