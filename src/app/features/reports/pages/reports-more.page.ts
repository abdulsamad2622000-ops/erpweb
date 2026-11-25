import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { money } from '../../pos/utils/pos-utils';
import { UI, errorMessage } from '../../purchase/utils/ui';
import { ReportsService } from '../services/reports.service';
import { AbcRow, Movement, abcAnalysis, classifyMovement } from '../utils/report-more-utils';
import { downloadCsv, monthRange, toCsv } from '../utils/report-utils';

interface MoveRow { name: string; sku: string; units: number; sold: number; oldestDays: number; movement: Movement }
type Tab = 'abc' | 'movement';

/** Step 15: ABC analysis aur fast/slow/dead stock. Cost nahi dikhta. */
@Component({
  selector: 'app-reports-more-page',
  imports: [FormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">More reports</h1>
        <a routerLink="/reports" [class]="ui.btn">Back to reports</a>
      </div>
      <div class="flex flex-wrap gap-1" role="tablist" aria-label="More reports">
        @for (t of tabs; track t.id) {
          <button type="button" role="tab" [attr.aria-selected]="tab() === t.id" class="min-h-11 rounded-lg border px-4 text-sm"
            [class]="tab() === t.id ? 'border-[#1E3A8A] bg-[#1E3A8A] text-white' : 'border-slate-400'" (click)="tab.set(t.id)">{{ t.label }}</button>
        }
      </div>
      <div class="flex flex-wrap items-end gap-2">
        <label class="text-sm font-medium">From<input type="date" [class]="ui.input + ' mt-1'" [(ngModel)]="from" /></label>
        <label class="text-sm font-medium">To<input type="date" [class]="ui.input + ' mt-1'" [(ngModel)]="to" /></label>
        <button type="button" [class]="ui.primary" [disabled]="busy()" (click)="load()">Show</button>
        <button type="button" [class]="ui.btn" [disabled]="!hasData()" (click)="exportCsv()">CSV</button>
      </div>
      @if (error(); as e) { <p role="alert" class="text-sm text-red-700">{{ e }}</p> }
      @if (busy()) { <p role="status" class="text-sm">Loading...</p> }

      @if (tab() === 'abc') {
        <div [class]="ui.tableWrap"><table class="w-full min-w-[36rem] text-sm">
          <thead [class]="ui.thead"><tr>
            <th scope="col" [class]="ui.th">Item</th>
            <th scope="col" [class]="ui.th + ' text-end'">Revenue</th>
            <th scope="col" [class]="ui.th + ' text-end'">Share %</th>
            <th scope="col" [class]="ui.th + ' text-end'">Cumulative %</th>
            <th scope="col" [class]="ui.th">Class</th>
          </tr></thead>
          <tbody>
            @for (x of abc(); track x.key) {
              <tr [class]="ui.tr"><td [class]="ui.td">{{ x.label }}</td>
                <td [class]="ui.td + ' text-end'">{{ fmt(x.revenue) }}</td><td [class]="ui.td + ' text-end'">{{ x.share }}</td>
                <td [class]="ui.td + ' text-end'">{{ x.cumulative }}</td><td [class]="ui.td"><b>{{ x.cls }}</b></td></tr>
            } @empty { <tr><td colspan="5" class="px-4 py-6 text-center text-slate-600">No data for this period.</td></tr> }
          </tbody>
        </table></div>
      } @else {
        <p class="text-sm">Fast: {{ count('fast') }} · Slow: {{ count('slow') }} · Dead (not sold, 90+ days): <b>{{ count('dead') }}</b></p>
        <div [class]="ui.tableWrap"><table class="w-full min-w-[40rem] text-sm">
          <thead [class]="ui.thead"><tr>
            <th scope="col" [class]="ui.th">Item</th>
            <th scope="col" [class]="ui.th + ' text-end'">In stock</th>
            <th scope="col" [class]="ui.th + ' text-end'">Sold</th>
            <th scope="col" [class]="ui.th + ' text-end'">Oldest (days)</th>
            <th scope="col" [class]="ui.th">Movement</th>
          </tr></thead>
          <tbody>
            @for (x of movement(); track x.sku) {
              <tr [class]="ui.tr"><td [class]="ui.td">{{ x.name }} <span class="text-xs text-slate-600">{{ x.sku }}</span></td>
                <td [class]="ui.td + ' text-end'">{{ x.units }}</td><td [class]="ui.td + ' text-end'">{{ x.sold }}</td>
                <td [class]="ui.td + ' text-end'">{{ x.oldestDays }}</td><td [class]="ui.td"><b>{{ x.movement }}</b></td></tr>
            } @empty { <tr><td colspan="5" class="px-4 py-6 text-center text-slate-600">No stock.</td></tr> }
          </tbody>
        </table></div>
      }
    </section>
  `,
})
export class ReportsMorePage implements OnInit {
  private readonly api = inject(ReportsService);
  protected readonly ui = UI;
  protected readonly tabs: { id: Tab; label: string }[] = [{ id: 'abc', label: 'ABC analysis' }, { id: 'movement', label: 'Fast, slow and dead stock' }];
  protected readonly tab = signal<Tab>('abc');
  protected readonly abc = signal<AbcRow[]>([]);
  protected readonly movement = signal<MoveRow[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly hasData = computed(() => (this.tab() === 'abc' ? this.abc().length : this.movement().length) > 0);
  protected from = monthRange().from;
  protected to = monthRange().to;

  ngOnInit(): void { void this.load(); }
  protected fmt(n: number): string { return money(n); }
  protected count(m: Movement): number { return this.movement().filter((x) => x.movement === m).length; }

  protected async load(): Promise<void> {
    this.busy.set(true);
    try {
      const [sales, stock] = await Promise.all([
        firstValueFrom(this.api.sales(this.from, this.to, 'product')),
        firstValueFrom(this.api.stock()),
      ]);
      this.abc.set(abcAnalysis(sales.rows.map((r) => ({ key: r.key, label: r.label, revenue: r.revenue }))));
      const soldBy = new Map(sales.rows.map((r) => [r.key, r.qty]));
      this.movement.set(stock.rows.map((s) => {
        const sold = soldBy.get(String(s.productId)) ?? 0;
        return { name: s.name, sku: s.sku, units: s.units, sold, oldestDays: s.oldestDays, movement: classifyMovement(sold, s.units, s.oldestDays) };
      }));
      this.error.set(null);
    } catch (e) {
      this.error.set(errorMessage(e, 'Something went wrong.'));
    } finally {
      this.busy.set(false);
    }
  }

  protected exportCsv(): void {
    const csv = this.tab() === 'abc'
      ? toCsv(['Item', 'Revenue', 'Share %', 'Cumulative %', 'Class'], this.abc().map((x) => [x.label, x.revenue, x.share, x.cumulative, x.cls]))
      : toCsv(['Item', 'SKU', 'In stock', 'Sold', 'Oldest days', 'Movement'], this.movement().map((x) => [x.name, x.sku, x.units, x.sold, x.oldestDays, x.movement]));
    downloadCsv(`${this.tab()}-${this.from}-${this.to}.csv`, csv);
  }
}
