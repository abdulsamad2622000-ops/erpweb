import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { UI, errorMessage } from '../../purchase/utils/ui';
import { SerialDetail } from '../models/inventory.models';
import { InventoryService } from '../services/inventory.service';
import { STOCK_TONE } from '../utils/inventory-ui';

@Component({
  selector: 'app-serial-detail-page',
  imports: [RouterLink, TranslocoPipe, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-4xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold"><code dir="ltr">{{ serialCode }}</code></h1>
        <a routerLink="/inventory/serials" [class]="ui.btn">{{ 'inventory.detail.back' | transloco }}</a>
      </div>

      @if (error(); as e) {
        <div role="alert" class="space-y-2 rounded-lg border border-red-600 p-3">
          <p class="text-sm text-red-600">{{ e }}</p>
          <button type="button" [class]="ui.btn" (click)="load()">{{ 'common.retry' | transloco }}</button>
        </div>
      } @else if (loading()) {
        <p role="status" class="text-sm text-slate-500">{{ 'common.loading' | transloco }}</p>
      } @else if (data(); as d) {
        <div [class]="ui.card + ' space-y-2'">
          <div class="flex flex-wrap items-center gap-3">
            <span class="font-medium">{{ d.name }}</span>
            <app-status-badge [label]="'inventory.status.' + d.status | transloco" [tone]="tone[d.status]" />
            @if (d.reservedRef) { <app-status-badge [label]="('inventory.stock.reserved' | transloco) + ' - ' + d.reservedRef" tone="info" /> }
          </div>
          <dl class="grid gap-2 text-sm sm:grid-cols-3">
            <div><dt class="text-slate-600 dark:text-slate-400">SKU</dt><dd>{{ d.sku }}</dd></div>
            <div><dt class="text-slate-600 dark:text-slate-400">{{ 'purchase.orders.supplier' | transloco }}</dt><dd>{{ d.supplierName }}</dd></div>
            <div><dt class="text-slate-600 dark:text-slate-400">GRN</dt><dd>{{ d.grnNumber }}</dd></div>
          </dl>
        </div>

        <div [class]="ui.card">
          <h2 class="mb-3 text-base font-semibold">{{ 'inventory.detail.history' | transloco }}</h2>
          <ol class="space-y-3 border-s border-slate-300 ps-4 dark:border-slate-600">
            @for (t of d.timeline; track t.at + t.ref) {
              <li>
                <p class="text-sm font-medium">{{ 'inventory.detail.types.' + t.type | transloco }} · {{ t.ref }}</p>
                <p class="text-xs text-slate-500">{{ t.at.slice(0, 16).replace('T', ' ') }}</p>
                @if (t.note) { <p class="text-sm">{{ t.note }}</p> }
              </li>
            }
          </ol>
        </div>
      }
    </section>
  `,
})
export class SerialDetailPage implements OnInit {
  private readonly api = inject(InventoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(TranslocoService);
  protected readonly ui = UI;
  protected readonly tone = STOCK_TONE;
  protected readonly serialCode = this.route.snapshot.paramMap.get('serial') ?? '';

  protected readonly data = signal<SerialDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.data.set(await firstValueFrom(this.api.serial(this.serialCode)));
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('errors.generic')));
    } finally {
      this.loading.set(false);
    }
  }
}