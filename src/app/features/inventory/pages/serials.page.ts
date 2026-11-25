import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { UI } from '../../purchase/utils/ui';
import { StockSerial, StockStatus } from '../models/inventory.models';
import { InventoryService } from '../services/inventory.service';
import { STOCK_STATUSES, STOCK_TONE } from '../utils/inventory-ui';

@Component({
  selector: 'app-serials-page',
  imports: [FormsModule, RouterLink, TranslocoPipe, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl space-y-4">
      <h1 class="text-xl font-semibold">{{ 'inventory.serials.title' | transloco }}</h1>

      <div class="flex flex-wrap items-end gap-3">
        <div>
          <label for="ser-q" class="mb-1 block text-sm">{{ 'common.search' | transloco }}</label>
          <input placeholder="Enter ser q..." id="ser-q" dir="ltr" [class]="ui.input + ' w-64'" [ngModel]="q()" (ngModelChange)="q.set($event); load()" />
        </div>
        <div>
          <label for="ser-status" class="mb-1 block text-sm">{{ 'inventory.serials.status' | transloco }}</label>
          <select id="ser-status" [class]="ui.input" [ngModel]="status()" (ngModelChange)="status.set($event); load()">
            <option value="">{{ 'inventory.serials.allStatuses' | transloco }}</option>
            @for (s of statuses; track s) { <option [value]="s">{{ 'inventory.status.' + s | transloco }}</option> }
          </select>
        </div>
      </div>

      @if (error(); as e) {
        <div role="alert" class="space-y-2 rounded-lg border border-red-600 p-3">
          <p class="text-sm text-red-600">{{ e }}</p>
          <button type="button" [class]="ui.btn" (click)="load()">{{ 'common.retry' | transloco }}</button>
        </div>
      }

      <div [class]="ui.tableWrap">
        <table class="w-full min-w-[44rem] text-start text-sm">
          <thead [class]="ui.thead"><tr>
            <th scope="col" [class]="ui.th">{{ 'purchase.grn.serial' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'inventory.stock.product' | transloco }}</th>
            <th scope="col" [class]="ui.th">GRN</th>
            <th scope="col" [class]="ui.th">{{ 'purchase.orders.supplier' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'inventory.serials.status' | transloco }}</th>
          </tr></thead>
          <tbody>
            @if (loading()) {
              <tr><td colspan="5" class="px-4 py-6 text-center text-slate-500" role="status">{{ 'common.loading' | transloco }}</td></tr>
            } @else {
              @for (s of rows(); track s.serial) {
                <tr [class]="ui.tr">
                  <td [class]="ui.td">
                    <a [routerLink]="['/inventory/serials', s.serial]" class="font-medium text-[#1E3A8A] underline dark:text-sky-300"><code dir="ltr">{{ s.serial }}</code></a>
                  </td>
                  <td [class]="ui.td">{{ s.name }}</td>
                  <td [class]="ui.td">{{ s.grnNumber }}</td>
                  <td [class]="ui.td">{{ s.supplierName }}</td>
                  <td [class]="ui.td"><app-status-badge [label]="'inventory.status.' + s.status | transloco" [tone]="tone[s.status]" />@if (s.reservedRef) { <span class="ms-2"><app-status-badge [label]="'inventory.stock.reserved' | transloco" tone="info" /></span> }</td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="px-4 py-6 text-center text-slate-500">{{ 'inventory.serials.empty' | transloco }}</td></tr>
              }
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class SerialsPage implements OnInit {
  private readonly api = inject(InventoryService);
  private readonly i18n = inject(TranslocoService);
  protected readonly ui = UI;
  protected readonly tone = STOCK_TONE;
  protected readonly statuses = STOCK_STATUSES;

  protected readonly rows = signal<StockSerial[]>([]);
  protected readonly q = signal('');
  protected readonly status = signal<StockStatus | ''>('');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.rows.set(await firstValueFrom(this.api.serials(this.q().trim(), this.status())));
    } catch {
      this.error.set(this.i18n.translate('errors.generic'));
    } finally {
      this.loading.set(false);
    }
  }
}