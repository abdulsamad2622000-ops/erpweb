import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { money } from '../../pos/utils/pos-utils';
import { UI, errorMessage } from '../../purchase/utils/ui';
import { Dashboard } from '../models/report.models';
import { ReportsService } from '../services/reports.service';
import { barHeights } from '../utils/report-utils';

/** Step 15: dashboard — aaj/mahine ki sale, munafa, udhaar, stock, kaam jo baqi hai. */
@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl space-y-4">
      <h1 class="text-xl font-semibold">{{ 'dashboardPage.hello' | transloco: { name: name() } }}</h1>
      @if (error(); as e) { <p role="alert" class="text-sm text-red-600">{{ e }}</p> }
      @if (d(); as d) {
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div [class]="ui.card"><p class="text-sm text-slate-600 dark:text-slate-400">{{ 'dashboardPage.today' | transloco }}</p>
            <p class="text-2xl font-semibold text-[#1E3A8A] dark:text-sky-300">Rs {{ fmt(d.todaySales) }}</p>
            <p class="text-xs">{{ 'dashboardPage.bills' | transloco: { n: d.todayBills } }}
              @if (d.canSeeMoney) { · {{ 'dashboardPage.cash' | transloco }}: Rs {{ fmt(d.todayCash ?? 0) }} }</p></div>
          <div [class]="ui.card"><p class="text-sm text-slate-600 dark:text-slate-400">{{ 'dashboardPage.month' | transloco }}</p>
            <p class="text-2xl font-semibold">Rs {{ fmt(d.monthSales) }}</p>
            @if (d.canSeeMoney) {
              <p class="text-xs text-green-700 dark:text-green-400">{{ 'dashboardPage.profit' | transloco }}: Rs {{ fmt(d.monthProfit ?? 0) }}</p>
              <p class="text-xs">{{ 'dashboardPage.expenses' | transloco }}: Rs {{ fmt(d.monthExpenses ?? 0) }} ·
                <b [class.text-red-600]="(d.monthNet ?? 0) < 0">{{ 'dashboardPage.net' | transloco }}: Rs {{ fmt(d.monthNet ?? 0) }}</b></p>
            }</div>
          @if (d.canSeeMoney) {
            <a routerLink="/customers/aging" [class]="ui.card + ' block'"><p class="text-sm text-slate-600 dark:text-slate-400">{{ 'dashboardPage.receivable' | transloco }}</p>
              <p class="text-2xl font-semibold">Rs {{ fmt(d.receivable ?? 0) }}</p>
              @if ((d.overdue ?? 0) > 0) { <p class="text-xs text-red-600">{{ 'dashboardPage.overdue' | transloco }}: Rs {{ fmt(d.overdue ?? 0) }}</p> }</a>
            <div [class]="ui.card"><p class="text-sm text-slate-600 dark:text-slate-400">{{ 'dashboardPage.stock' | transloco }}</p>
              <p class="text-2xl font-semibold">{{ d.stockUnits }} <span class="text-sm font-normal">{{ 'dashboardPage.units' | transloco }}</span></p>
              <p class="text-xs">{{ 'dashboardPage.atCost' | transloco }}: Rs {{ fmt(d.stockValue ?? 0) }} · {{ 'dashboardPage.payable' | transloco }}: Rs {{ fmt(d.payable ?? 0) }}</p></div>
          } @else {
            <div [class]="ui.card"><p class="text-sm text-slate-600 dark:text-slate-400">{{ 'dashboardPage.stock' | transloco }}</p>
              <p class="text-2xl font-semibold">{{ d.stockUnits }} <span class="text-sm font-normal">{{ 'dashboardPage.units' | transloco }}</span></p></div>
          }
        </div>

        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <a routerLink="/warranty" [class]="ui.card + ' block'">{{ 'dashboardPage.openRepairs' | transloco }}<br /><b class="text-lg">{{ d.openRepairs }}</b>
            @if (d.readyRepairs) { <span class="text-xs text-green-700"> · {{ 'dashboardPage.ready' | transloco: { n: d.readyRepairs } }}</span> }</a>
          <a routerLink="/sales/orders" [class]="ui.card + ' block'">{{ 'dashboardPage.openOrders' | transloco }}<br /><b class="text-lg">{{ d.openOrders }}</b></a>
          <a routerLink="/purchase/orders" [class]="ui.card + ' block'">{{ 'dashboardPage.pendingPOs' | transloco }}<br /><b class="text-lg">{{ d.pendingPOs }}</b></a>
          <a routerLink="/sales/pos" [class]="ui.primary + ' flex items-center justify-center text-base'">{{ 'dashboardPage.openPos' | transloco }}</a>
        </div>

        <div [class]="ui.card">
          <h2 class="mb-3 font-semibold">{{ 'dashboardPage.last14' | transloco }}</h2>
          <div class="flex h-40 items-end gap-1" role="img" [attr.aria-label]="'dashboardPage.last14' | transloco">
            @for (b of bars(); track b.date) {
              <div class="flex flex-1 flex-col items-center justify-end gap-1" [title]="b.date + ': Rs ' + fmt(b.total)">
                <div class="w-full rounded-t bg-[#1E3A8A] dark:bg-sky-500" [style.height.%]="b.h" [style.min-height.px]="b.total > 0 ? 2 : 0"></div>
                <span class="text-[10px] text-slate-600 dark:text-slate-400">{{ b.date.slice(8) }}</span>
              </div>
            }
          </div>
        </div>

        @if (d.topProducts?.length) {
          <div [class]="ui.card">
            <h2 class="mb-2 font-semibold">{{ 'dashboardPage.top' | transloco }}</h2>
            <ol class="space-y-1 text-sm">
              @for (p of d.topProducts; track p.name) {
                <li class="flex justify-between gap-2"><span>{{ p.name }} · {{ p.qty }}</span><span>Rs {{ fmt(p.revenue) }}</span></li>
              }
            </ol>
          </div>
        }
      }
    </section>
  `,
})
export class DashboardPage implements OnInit {
  private readonly api = inject(ReportsService);
  private readonly i18n = inject(TranslocoService);
  private readonly auth = inject(AuthStore);
  protected readonly ui = UI;
  protected readonly d = signal<Dashboard | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly name = computed(() => this.auth.user()?.name ?? '');
  protected readonly bars = computed(() => {
    const s = this.d()?.last14 ?? [];
    const h = barHeights(s.map((x) => x.total));
    return s.map((x, i) => ({ ...x, h: h[i] }));
  });

  async ngOnInit(): Promise<void> {
    try {
      this.d.set(await firstValueFrom(this.api.dashboard()));
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('errors.generic')));
    }
  }

  protected fmt(n: number): string {
    return money(n);
  }
}
