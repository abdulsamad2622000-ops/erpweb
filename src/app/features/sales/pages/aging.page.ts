import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { money } from '../../pos/utils/pos-utils';
import { UI, errorMessage } from '../../purchase/utils/ui';
import { AgingReport } from '../models/sales.models';
import { SalesService } from '../services/sales.service';

/** Step 13: receivables aging — due date ke baad kitne din (not due, 1-30, 31-60, 61-90, 90+). */
@Component({
  selector: 'app-aging-page',
  imports: [RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">{{ 'agingPage.title' | transloco }}</h1>
        <a routerLink="/customers" [class]="ui.btn">{{ 'salesDocs.back' | transloco }}</a>
      </div>
      @if (error(); as e) { <p role="alert" class="text-sm text-red-600">{{ e }}</p> }
      @if (r(); as r) {
        <div [class]="ui.tableWrap">
          <table class="w-full min-w-[48rem] text-sm">
            <thead [class]="ui.thead"><tr>
              <th scope="col" [class]="ui.th">{{ 'salesDocs.customer' | transloco }}</th>
              @for (k of keys; track k) { <th scope="col" [class]="ui.th + ' text-end'">{{ 'agingPage.' + k | transloco }}</th> }
              <th scope="col" [class]="ui.th + ' text-end'">{{ 'posPage.total' | transloco }}</th>
            </tr></thead>
            <tbody>
              @for (row of r.rows; track row.customerId) {
                <tr [class]="ui.tr">
                  <td [class]="ui.td"><a [routerLink]="['/customers', row.customerId, 'ledger']" class="font-medium text-[#1E3A8A] underline dark:text-sky-300">{{ row.name }}</a>
                    <div class="text-xs text-slate-600 dark:text-slate-400" dir="ltr">{{ row.phone }}</div></td>
                  @for (k of keys; track k) {
                    <td [class]="ui.td + ' text-end'" [class.text-red-600]="k !== 'current' && row[k] > 0">{{ row[k] ? fmt(row[k]) : '' }}</td>
                  }
                  <td [class]="ui.td + ' text-end font-semibold'">{{ fmt(row.total) }}
                    @if (row.creditLimit && row.total > row.creditLimit) { <div class="text-xs text-red-600">{{ 'agingPage.overLimit' | transloco }}</div> }</td>
                </tr>
              } @empty {
                <tr><td colspan="7" class="px-4 py-6 text-center text-slate-500">{{ 'agingPage.none' | transloco }}</td></tr>
              }
            </tbody>
            <tfoot><tr class="font-semibold">
              <td class="px-3 py-2">{{ 'posPage.total' | transloco }}</td>
              @for (k of keys; track k) { <td class="px-3 py-2 text-end">{{ fmt(r.totals[k]) }}</td> }
              <td class="px-3 py-2 text-end">{{ fmt(r.totals.total) }}</td>
            </tr></tfoot>
          </table>
        </div>
      }
    </section>
  `,
})
export class AgingPage implements OnInit {
  private readonly api = inject(SalesService);
  private readonly i18n = inject(TranslocoService);
  protected readonly ui = UI;
  protected readonly keys = ['current', 'd30', 'd60', 'd90', 'over90'] as const;
  protected readonly r = signal<AgingReport | null>(null);
  protected readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      this.r.set(await firstValueFrom(this.api.aging()));
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('errors.generic')));
    }
  }

  protected fmt(n: number): string {
    return money(n);
  }
}
