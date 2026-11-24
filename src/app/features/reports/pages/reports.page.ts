import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core'; import { AuthStore } from '../../../core/auth/auth.store';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { money } from '../../pos/utils/pos-utils';
import { UI, errorMessage } from '../../purchase/utils/ui';
import { PurchaseReport, RepairReport, SalesGroup, SalesReport, StockReport } from '../models/report.models';
import { ReportsService } from '../services/reports.service';
import { ProfitReport } from '../../accounts/models/accounts.models';
import { AccountsService } from '../../accounts/services/accounts.service';
import { LabelsService } from '../../labels/services/labels.service';
import { PrintLogEntry } from '../../labels/models/label.models';
import { Cell, downloadCsv, downloadXlsx, inDateRange, monthRange, toCsv } from '../utils/report-utils';

type Tab = 'profit' | 'sales' | 'stock' | 'purchases' | 'repairs' | 'prints';

/** Step 15: reports — sales/munafa, stock value, purchases, repairs. CSV export. */
@Component({
  selector: 'app-reports-page',
  imports: [FormsModule, RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3"><h1 class="text-xl font-semibold">{{ 'reportsPage.title' | transloco }}</h1><a routerLink="/reports/more" [class]="ui.btn">More reports</a></div>
      <div class="flex flex-wrap gap-1" role="tablist" [attr.aria-label]="'reportsPage.title' | transloco">
        @for (t of tabs(); track t) {
          <button type="button" role="tab" [attr.aria-selected]="tab() === t" class="min-h-11 rounded-lg border px-4 text-sm"
            [class]="tab() === t ? 'border-[#1E3A8A] bg-[#1E3A8A] text-white' : 'border-slate-400'" (click)="setTab(t)">{{ 'reportsPage.tabs.' + t | transloco }}</button>
        }
      </div>
      <div class="flex flex-wrap items-end gap-2">
        @if (tab() !== 'stock') {
          <label class="text-sm font-medium">{{ 'ledgerPage.from' | transloco }}<input type="date" [class]="ui.input + ' mt-1'" [(ngModel)]="from" /></label>
          <label class="text-sm font-medium">{{ 'ledgerPage.to' | transloco }}<input type="date" [class]="ui.input + ' mt-1'" [(ngModel)]="to" /></label>
        }
        @if (tab() === 'sales') {
          <label class="text-sm font-medium">{{ 'reportsPage.groupBy' | transloco }}
            <select [class]="ui.input + ' mt-1'" [(ngModel)]="groupBy">
              @for (g of groups; track g) { <option [value]="g">{{ 'reportsPage.by.' + g | transloco }}</option> }
            </select></label>
        }
        <button type="button" [class]="ui.primary" [disabled]="busy()" (click)="load()">{{ 'ledgerPage.show' | transloco }}</button>
        <button type="button" [class]="ui.btn" [disabled]="!hasData()" (click)="exportCsv()">{{ 'reportsPage.csv' | transloco }}</button>
        <button type="button" [class]="ui.btn" [disabled]="!hasData()" (click)="exportXlsx()">{{ 'reportsPage.xlsx' | transloco }}</button>
      </div>
      @if (error(); as e) { <p role="alert" class="text-sm text-red-600">{{ e }}</p> }

      @if (tab() === 'profit' && profit(); as r) {
        <div [class]="ui.card + ' max-w-xl space-y-1 text-sm'">
          <div class="flex justify-between"><span>{{ 'reportsPage.pl.sales' | transloco }}</span><span>{{ fmt(r.salesRevenue) }}</span></div>
          <div class="flex justify-between"><span>− {{ 'reportsPage.pl.cogs' | transloco }}</span><span>{{ fmt(r.costOfGoods) }}</span></div>
          <div class="flex justify-between"><span>+ {{ 'reportsPage.pl.repair' | transloco }}</span><span>{{ fmt(r.repairIncome) }}</span></div>
          <div class="flex justify-between"><span>− {{ 'reportsPage.pl.repairCost' | transloco }}</span><span>{{ fmt(r.repairPartsCost) }}</span></div>
          <div class="flex justify-between border-t border-slate-200 pt-1 font-semibold dark:border-slate-700"><span>{{ 'reportsPage.pl.gross' | transloco }}</span><span>{{ fmt(r.grossProfit) }}</span></div>
          @for (e of r.expensesByCategory; track e.category) {
            <div class="flex justify-between ps-3"><span>− {{ e.category }}</span><span>{{ fmt(e.amount) }}</span></div>
          }
          <div class="flex justify-between"><span>− {{ 'reportsPage.pl.expenses' | transloco }}</span><span>{{ fmt(r.expenses) }}</span></div>
          <div class="flex justify-between border-t border-slate-200 pt-1 text-lg font-semibold dark:border-slate-700"
            [class.text-red-600]="r.netProfit < 0" [class.text-green-700]="r.netProfit >= 0"><span>{{ 'reportsPage.pl.net' | transloco }}</span><span>Rs {{ fmt(r.netProfit) }}</span></div>
        </div>
      }

      @if (tab() === 'sales' && sales(); as r) {
        <div class="grid gap-3 sm:grid-cols-4">
          <div [class]="ui.card">{{ 'reportsPage.revenue' | transloco }}<br /><b class="text-lg">Rs {{ fmt(r.totals.revenue) }}</b></div>
          @if (canCost()) { <div [class]="ui.card">{{ 'reportsPage.cost' | transloco }}<br /><b class="text-lg">Rs {{ fmt(r.totals.cost) }}</b></div> }
          @if (canCost()) { <div [class]="ui.card">{{ 'reportsPage.profit' | transloco }}<br /><b class="text-lg text-green-700 dark:text-green-400">Rs {{ fmt(r.totals.profit) }}</b> ({{ r.totals.margin }}%)</div> }
          <div [class]="ui.card">{{ 'reportsPage.bills' | transloco }}<br /><b class="text-lg">{{ r.totals.bills }}</b> · {{ 'reportsPage.returns' | transloco }} Rs {{ fmt(r.totals.returns) }}</div>
        </div>
        <div [class]="ui.tableWrap"><table class="w-full min-w-[44rem] text-sm">
          <thead [class]="ui.thead"><tr>
            <th scope="col" [class]="ui.th">{{ 'reportsPage.by.' + r.groupBy | transloco }}</th>
            <th scope="col" [class]="ui.th + ' text-end'">{{ 'reportsPage.bills' | transloco }}</th>
            <th scope="col" [class]="ui.th + ' text-end'">{{ 'posPage.qty' | transloco }}</th>
            <th scope="col" [class]="ui.th + ' text-end'">{{ 'reportsPage.revenue' | transloco }}</th>
            @if (canCost()) { <th scope="col" [class]="ui.th + ' text-end'">{{ 'reportsPage.cost' | transloco }}</th> }
            @if (canCost()) { <th scope="col" [class]="ui.th + ' text-end'">{{ 'reportsPage.profit' | transloco }}</th> }
            @if (canCost()) { <th scope="col" [class]="ui.th + ' text-end'">%</th> }
          </tr></thead>
          <tbody>
            @for (x of r.rows; track x.key) {
              <tr [class]="ui.tr"><td [class]="ui.td">{{ r.groupBy === 'channel' ? ('salesDocs.channel.' + x.label | transloco) : x.label }}</td>
                <td [class]="ui.td + ' text-end'">{{ x.bills }}</td><td [class]="ui.td + ' text-end'">{{ x.qty }}</td>
                <td [class]="ui.td + ' text-end'">{{ fmt(x.revenue) }}</td>@if (canCost()) { <td [class]="ui.td + ' text-end'">{{ fmt(x.cost) }}</td> }
                @if (canCost()) { <td [class]="ui.td + ' text-end'" [class.text-red-600]="x.profit < 0">{{ fmt(x.profit) }}</td><td [class]="ui.td + ' text-end'">{{ x.margin }}</td> }</tr>
            } @empty { <tr><td colspan="7" class="px-4 py-6 text-center text-slate-500">{{ 'common.empty' | transloco }}</td></tr> }
          </tbody>
        </table></div>
        @if (canCost()) { <p class="text-xs text-slate-600 dark:text-slate-400">{{ 'reportsPage.costNote' | transloco }}</p> }
      }

      @if (tab() === 'stock' && stock(); as r) {
        <div class="grid gap-3 sm:grid-cols-3">
          <div [class]="ui.card">{{ 'dashboardPage.units' | transloco }}<br /><b class="text-lg">{{ r.totals.units }}</b></div>
          @if (canCost()) { <div [class]="ui.card">{{ 'dashboardPage.atCost' | transloco }}<br /><b class="text-lg">Rs {{ fmt(r.totals.value) }}</b></div> }
          <div [class]="ui.card">{{ 'reportsPage.atRetail' | transloco }}<br /><b class="text-lg">Rs {{ fmt(r.totals.retailValue) }}</b></div>
        </div>
        <p class="text-sm">@for (s of statusKeys(r); track s) { <span class="me-3">{{ 'inventory.status.' + s | transloco }}: <b>{{ r.byStatus[s] }}</b></span> }</p>
        <div [class]="ui.tableWrap"><table class="w-full min-w-[40rem] text-sm">
          <thead [class]="ui.thead"><tr>
            <th scope="col" [class]="ui.th">{{ 'posPage.item' | transloco }}</th>
            <th scope="col" [class]="ui.th + ' text-end'">{{ 'dashboardPage.units' | transloco }}</th>
            @if (canCost()) { <th scope="col" [class]="ui.th + ' text-end'">{{ 'dashboardPage.atCost' | transloco }}</th> }
            <th scope="col" [class]="ui.th + ' text-end'">{{ 'reportsPage.atRetail' | transloco }}</th>
            <th scope="col" [class]="ui.th + ' text-end'">{{ 'reportsPage.oldest' | transloco }}</th>
          </tr></thead>
          <tbody>
            @for (x of r.rows; track x.productId) {
              <tr [class]="ui.tr"><td [class]="ui.td">{{ x.name }} <span class="text-xs text-slate-500" dir="ltr">{{ x.sku }}</span></td>
                <td [class]="ui.td + ' text-end'">{{ x.units }}</td>@if (canCost()) { <td [class]="ui.td + ' text-end'">{{ fmt(x.value) }}</td> }
                <td [class]="ui.td + ' text-end'">{{ x.retailValue === null ? '—' : fmt(x.retailValue) }}</td>
                <td [class]="ui.td + ' text-end'" [class.text-red-600]="x.oldestDays > 90">{{ x.oldestDays }}</td></tr>
            } @empty { <tr><td colspan="5" class="px-4 py-6 text-center text-slate-500">{{ 'common.empty' | transloco }}</td></tr> }
          </tbody>
        </table></div>
      }

      @if (tab() === 'purchases' && purchases(); as r) {
        <div class="grid gap-3 sm:grid-cols-3">
          <div [class]="ui.card">{{ 'reportsPage.billed' | transloco }}<br /><b class="text-lg">Rs {{ fmt(r.totals.billed) }}</b></div>
          <div [class]="ui.card">{{ 'reportsPage.paidOut' | transloco }}<br /><b class="text-lg">Rs {{ fmt(r.totals.paid) }}</b></div>
          <div [class]="ui.card">{{ 'dashboardPage.payable' | transloco }}<br /><b class="text-lg">Rs {{ fmt(r.totals.payable) }}</b></div>
        </div>
        <div [class]="ui.tableWrap"><table class="w-full text-sm">
          <thead [class]="ui.thead"><tr>
            <th scope="col" [class]="ui.th">{{ 'reportsPage.supplier' | transloco }}</th>
            <th scope="col" [class]="ui.th + ' text-end'">{{ 'reportsPage.bills' | transloco }}</th>
            <th scope="col" [class]="ui.th + ' text-end'">{{ 'reportsPage.billed' | transloco }}</th>
            <th scope="col" [class]="ui.th + ' text-end'">{{ 'reportsPage.paidOut' | transloco }}</th>
            <th scope="col" [class]="ui.th + ' text-end'">{{ 'dashboardPage.payable' | transloco }}</th>
          </tr></thead>
          <tbody>
            @for (x of r.rows; track x.supplierId) {
              <tr [class]="ui.tr"><td [class]="ui.td">{{ x.name }}</td><td [class]="ui.td + ' text-end'">{{ x.bills }}</td>
                <td [class]="ui.td + ' text-end'">{{ fmt(x.billed) }}</td><td [class]="ui.td + ' text-end'">{{ fmt(x.paid) }}</td>
                <td [class]="ui.td + ' text-end'">{{ fmt(x.payable) }}</td></tr>
            } @empty { <tr><td colspan="5" class="px-4 py-6 text-center text-slate-500">{{ 'common.empty' | transloco }}</td></tr> }
          </tbody>
        </table></div>
      }

      @if (tab() === 'repairs' && repairs(); as r) {
        <div class="grid gap-3 sm:grid-cols-4">
          <div [class]="ui.card">{{ 'reportsPage.repairIncome' | transloco }}<br /><b class="text-lg">Rs {{ fmt(r.income) }}</b></div>
          <div [class]="ui.card">{{ 'reportsPage.delivered' | transloco }}<br /><b class="text-lg">{{ r.delivered }}</b> ({{ 'repairsPage.w.in_warranty' | transloco }}: {{ r.inWarranty }})</div>
          <div [class]="ui.card">{{ 'repairsPage.labour' | transloco }} / {{ 'repairsPage.part' | transloco }}<br /><b>Rs {{ fmt(r.labour) }} / Rs {{ fmt(r.parts) }}</b></div>
          <div [class]="ui.card">{{ 'reportsPage.receivedJobs' | transloco }}<br /><b class="text-lg">{{ r.received }}</b></div>
        </div>
        <div [class]="ui.card + ' text-sm'">
          <h2 class="mb-2 font-semibold">{{ 'repairsPage.openOnly' | transloco }}</h2>
          @for (s of openKeys(r); track s) { <span class="me-3">{{ 'repairsPage.status.' + s | transloco }}: <b>{{ r.open[s] }}</b></span> }
          @empty { {{ 'common.empty' | transloco }} }
        </div>
        @if (r.byTechnician.length) {
          <div [class]="ui.card + ' text-sm'"><h2 class="mb-2 font-semibold">{{ 'reportsPage.byTech' | transloco }}</h2>
            @for (t of r.byTechnician; track t.name) { <p>{{ t.name }}: {{ t.jobs }} · Rs {{ fmt(t.income) }}</p> }</div>
        }
      }
      @if (tab() === 'prints') {
        <div class="grid gap-3 sm:grid-cols-3">
          <div [class]="ui.card">{{ 'reportsPage.prints.total' | transloco }}<br /><b class="text-lg">{{ printTotals().jobs }}</b></div>
          <div [class]="ui.card">{{ 'reportsPage.prints.labels' | transloco }}<br /><b class="text-lg">{{ printTotals().labels }}</b></div>
          <div [class]="ui.card">{{ 'reportsPage.prints.reprints' | transloco }}<br /><b class="text-lg">{{ printTotals().reprints }}</b></div>
        </div>
        <label class="inline-flex min-h-11 items-center gap-2 text-sm">
          <input #ro type="checkbox" class="size-5" [checked]="reprintsOnly()" (change)="reprintsOnly.set(ro.checked)" />
          {{ 'reportsPage.prints.reprintsOnly' | transloco }}
        </label>
        <div [class]="ui.tableWrap"><table class="w-full min-w-[44rem] text-sm">
          <thead [class]="ui.thead"><tr>
            <th scope="col" [class]="ui.th">{{ 'labels.when' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'labels.template' | transloco }}</th>
            <th scope="col" [class]="ui.th + ' text-end'">{{ 'labels.count' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'labels.by' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'reportsPage.prints.type' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'common.reason.label' | transloco }}</th>
          </tr></thead>
          <tbody>
            @for (e of shownPrints(); track e.id) {
              <tr [class]="ui.tr"><td [class]="ui.td">{{ e.printedAt.slice(0, 16).replace('T', ' ') }}</td>
                <td [class]="ui.td">{{ e.templateName }}</td>
                <td [class]="ui.td + ' text-end'" [title]="e.codes.join(', ')">{{ e.codes.length }}</td>
                <td [class]="ui.td">{{ e.printedBy }}</td>
                <td [class]="ui.td">{{ (e.isReprint ? 'labels.reprint' : 'reportsPage.prints.print') | transloco }}</td>
                <td [class]="ui.td">{{ e.reason ?? '-' }}</td></tr>
            } @empty { <tr><td colspan="6" class="px-4 py-6 text-center text-slate-500">{{ 'common.empty' | transloco }}</td></tr> }
          </tbody>
        </table></div>
      }
    </section>
  `,
})
export class ReportsPage implements OnInit {
  private readonly api = inject(ReportsService);
  private readonly labels = inject(LabelsService);
  private readonly accounts = inject(AccountsService); private readonly auth = inject(AuthStore); protected readonly canCost = computed(() => this.auth.can('products.cost.view'));
  private readonly i18n = inject(TranslocoService);
  protected readonly ui = UI;
  protected readonly canPrints = computed(() => this.auth.can('barcode.label.view'));
  protected readonly tabs = computed<Tab[]>(() => {
    const base: Tab[] = this.canCost() ? ['profit', 'sales', 'stock', 'purchases', 'repairs'] : ['sales', 'stock', 'purchases', 'repairs'];
    return this.canPrints() ? [...base, 'prints'] : base;
  });
  protected readonly groups: SalesGroup[] = ['day', 'product', 'staff', 'channel'];
  protected readonly tab = signal<Tab>(this.canCost() ? 'profit' : 'sales');
  protected readonly profit = signal<ProfitReport | null>(null);
  protected readonly sales = signal<SalesReport | null>(null);
  protected readonly stock = signal<StockReport | null>(null);
  protected readonly purchases = signal<PurchaseReport | null>(null);
  protected readonly repairs = signal<RepairReport | null>(null);
  protected readonly prints = signal<PrintLogEntry[]>([]);
  protected readonly reprintsOnly = signal(false);
  protected readonly shownPrints = computed(() => (this.reprintsOnly() ? this.prints().filter((e) => e.isReprint) : this.prints()));
  protected readonly printTotals = computed(() => {
    const list = this.shownPrints();
    return { jobs: list.length, labels: list.reduce((n, e) => n + e.codes.length, 0), reprints: list.filter((e) => e.isReprint).length };
  });
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected from = monthRange().from;
  protected to = monthRange().to;
  protected groupBy: SalesGroup = 'day';

  ngOnInit(): void {
    void this.load();
  }

  protected fmt(n: number): string {
    return money(n);
  }

  protected statusKeys(r: StockReport): string[] {
    return Object.keys(r.byStatus);
  }

  protected openKeys(r: RepairReport): string[] {
    return Object.keys(r.open);
  }

  protected setTab(t: Tab): void {
    this.tab.set(t);
    void this.load();
  }

  protected hasData(): boolean {
    const t = this.tab();
    if (t === 'profit') return !!this.profit();
    if (t === 'prints') return this.shownPrints().length > 0;
    return t === 'sales' ? !!this.sales()?.rows.length : t === 'stock' ? !!this.stock()?.rows.length
      : t === 'purchases' ? !!this.purchases()?.rows.length : !!this.repairs();
  }

  protected async load(): Promise<void> {
    this.busy.set(true);
    try {
      const t = this.tab();
      if (t === 'profit' && !this.canCost()) { /* cost hidden */ } else if (t === 'profit') this.profit.set(await firstValueFrom(this.accounts.profit(this.from, this.to)));
      else if (t === 'prints') this.prints.set((await firstValueFrom(this.labels.log())).filter((e) => inDateRange(e.printedAt, this.from, this.to)));
      else if (t === 'sales') this.sales.set(await firstValueFrom(this.api.sales(this.from, this.to, this.groupBy)));
      else if (t === 'stock') this.stock.set(await firstValueFrom(this.api.stock()));
      else if (t === 'purchases') this.purchases.set(await firstValueFrom(this.api.purchases(this.from, this.to)));
      else this.repairs.set(await firstValueFrom(this.api.repairs(this.from, this.to)));
      this.error.set(null);
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('errors.generic')));
    } finally {
      this.busy.set(false);
    }
  }

  /** Tab ka table (headers + rows): CSV aur Excel dono isi se bante hain. */
  private table(): { headers: string[]; rows: Cell[][] } | null {
    const t = (k: string): string => this.i18n.translate(k);
    const tab = this.tab();
    if (tab === 'profit' && this.profit()) {
      const r = this.profit()!;
      return {
        headers: ['', 'Rs'],
        rows: [[t('reportsPage.pl.sales'), r.salesRevenue], [t('reportsPage.pl.cogs'), -r.costOfGoods], [t('reportsPage.pl.repair'), r.repairIncome],
          [t('reportsPage.pl.repairCost'), -r.repairPartsCost], [t('reportsPage.pl.gross'), r.grossProfit],
          ...r.expensesByCategory.map((e) => [e.category, -e.amount] as Cell[]), [t('reportsPage.pl.net'), r.netProfit]],
      };
    }
    if (tab === 'sales' && this.sales()) {
      const r = this.sales()!;
      return {
        headers: [t(`reportsPage.by.${r.groupBy}`), t('reportsPage.bills'), t('posPage.qty'), t('reportsPage.revenue'), ...(this.canCost() ? [t('reportsPage.cost'), t('reportsPage.profit'), '%'] : [])],
        rows: r.rows.map((x) => [x.label, x.bills, x.qty, x.revenue, ...(this.canCost() ? [x.cost, x.profit, x.margin] : [])]),
      };
    }
    if (tab === 'stock' && this.stock()) {
      return {
        headers: [t('posPage.item'), 'SKU', t('dashboardPage.units'), ...(this.canCost() ? [t('dashboardPage.atCost')] : []), t('reportsPage.atRetail'), t('reportsPage.oldest')],
        rows: this.stock()!.rows.map((x) => [x.name, x.sku, x.units, ...(this.canCost() ? [x.value] : []), x.retailValue, x.oldestDays]),
      };
    }
    if (tab === 'purchases' && this.purchases()) {
      return {
        headers: [t('reportsPage.supplier'), t('reportsPage.bills'), t('reportsPage.billed'), t('reportsPage.paidOut'), t('dashboardPage.payable')],
        rows: this.purchases()!.rows.map((x) => [x.name, x.bills, x.billed, x.paid, x.payable]),
      };
    }
    if (tab === 'prints') {
      return {
        headers: [t('labels.when'), t('labels.template'), t('labels.count'), t('labels.by'), t('reportsPage.prints.type'), t('common.reason.label'), t('reportsPage.prints.codes')],
        rows: this.shownPrints().map((e) => [e.printedAt.slice(0, 16).replace('T', ' '), e.templateName, e.codes.length, e.printedBy,
          e.isReprint ? t('labels.reprint') : t('reportsPage.prints.print'), e.reason ?? '', e.codes.join('; ')]),
      };
    }
    if (tab === 'repairs' && this.repairs()) {
      const r = this.repairs()!;
      return {
        headers: ['', ''],
        rows: [[t('reportsPage.repairIncome'), r.income], [t('reportsPage.delivered'), r.delivered], [t('repairsPage.labour'), r.labour],
          [t('repairsPage.part'), r.parts], [t('reportsPage.receivedJobs'), r.received]],
      };
    }
    return null;
  }

  protected exportCsv(): void {
    const tb = this.table();
    if (tb) downloadCsv(`${this.tab()}-${this.from}-${this.to}.csv`, toCsv(tb.headers, tb.rows));
  }

  protected async exportXlsx(): Promise<void> {
    const tb = this.table();
    if (!tb) return;
    try {
      await downloadXlsx(`${this.tab()}-${this.from}-${this.to}.xlsx`, this.i18n.translate(`reportsPage.tabs.${this.tab()}`), tb.headers, tb.rows);
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('errors.generic')));
    }
  }
}
