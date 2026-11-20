import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { ScanInputComponent } from '../../../shared/ui/scan-input/scan-input.component';
import { ScanSoundService } from '../../../shared/ui/scan-input/scan-sound.service';
import { formatMoney } from '../../products/utils/product-utils';
import { PurchaseReturn, ReturnableSerial } from '../models/payables.models';
import { PayablesService } from '../services/payables.service';
import { round2 } from '../utils/payables-utils';
import { isSerialFormatOk, normalizeSerial } from '../utils/purchase-utils';
import { UI, errorMessage } from '../utils/ui';

const MIN_REASON = 10;

@Component({
  selector: 'app-purchase-returns-page',
  imports: [TranslocoPipe, ScanInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl space-y-4">
      <h1 class="text-xl font-semibold">{{ 'purchase.payables.returns.title' | transloco }}</h1>

      @if (notice(); as n) { <p role="status" class="rounded-lg border border-green-600 p-3 text-sm text-green-700">{{ n }}</p> }
      @if (error(); as e) { <p role="alert" class="rounded-lg border border-red-600 p-3 text-sm text-red-600">{{ e }}</p> }

      @if (canCreate()) {
        <div [class]="ui.card + ' space-y-3'">
          <label for="ret-scan" class="block text-sm font-medium">{{ 'purchase.payables.returns.scan' | transloco }}</label>
          <app-scan-input inputId="ret-scan" [beep]="false" [placeholder]="'purchase.payables.returns.scanPlaceholder' | transloco" (scanned)="onScan($event.value)" />
          @if (scanError(); as s) { <p role="alert" class="text-sm text-red-600">{{ s }}</p> }

          @if (supplierName(); as sn) {
            <p class="text-sm">{{ 'purchase.orders.supplier' | transloco }}: <strong>{{ sn }}</strong></p>
          }

          <div [class]="ui.tableWrap">
            <table class="w-full min-w-[36rem] text-start text-sm">
              <thead [class]="ui.thead"><tr>
                <th scope="col" [class]="ui.th">{{ 'purchase.grn.serial' | transloco }}</th>
                <th scope="col" [class]="ui.th">{{ 'purchase.orders.product' | transloco }}</th>
                <th scope="col" [class]="ui.th">GRN</th>
                <th scope="col" [class]="ui.th + ' text-end'">{{ 'purchase.orders.unitCost' | transloco }}</th>
                <th scope="col" class="w-12"><span class="sr-only">{{ 'common.actions' | transloco }}</span></th>
              </tr></thead>
              <tbody>
                @for (l of lines(); track l.serial) {
                  <tr [class]="ui.tr">
                    <td [class]="ui.td"><code dir="ltr">{{ l.serial }}</code></td>
                    <td [class]="ui.td">{{ l.name }}</td>
                    <td [class]="ui.td">{{ l.grnNumber }}</td>
                    <td [class]="ui.td + ' text-end'">{{ money(l.unitCost) }}</td>
                    <td [class]="ui.td">
                      <button type="button" class="min-h-11 min-w-11 rounded-lg text-red-600" (click)="remove(l.serial)" [attr.aria-label]="'common.delete' | transloco">✕</button>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="5" class="px-4 py-6 text-center text-slate-500">{{ 'purchase.payables.returns.noLines' | transloco }}</td></tr>
                }
              </tbody>
            </table>
          </div>

          <div>
            <label for="ret-reason" class="mb-1 block text-sm">{{ 'common.reason.label' | transloco }} *</label>
            <textarea id="ret-reason" rows="2" [class]="ui.input + ' py-2'" [value]="reason()" (input)="reason.set(val($event))"></textarea>
            <p class="mt-1 text-xs text-slate-500">{{ 'common.reason.hint' | transloco: { min: minReason } }}</p>
          </div>

          <div class="flex flex-wrap items-center justify-between gap-3">
            <p class="text-base font-semibold">{{ 'purchase.orders.total' | transloco }}: Rs {{ money(total()) }}</p>
            <button type="button" [class]="ui.primary" [disabled]="busy() || lines().length === 0" (click)="submit()">
              {{ 'purchase.payables.returns.submit' | transloco }}
            </button>
          </div>
        </div>
      }

      <h2 class="text-base font-semibold">{{ 'purchase.payables.returns.history' | transloco }}</h2>
      <div [class]="ui.tableWrap">
        <table class="w-full min-w-[44rem] text-start text-sm">
          <thead [class]="ui.thead"><tr>
            <th scope="col" [class]="ui.th">{{ 'purchase.payables.returns.number' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'purchase.payables.date' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'purchase.orders.supplier' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'purchase.grn.items' | transloco }}</th>
            <th scope="col" [class]="ui.th + ' text-end'">{{ 'purchase.orders.total' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'common.reason.label' | transloco }}</th>
          </tr></thead>
          <tbody>
            @if (loading()) {
              <tr><td colspan="6" class="px-4 py-6 text-center text-slate-500" role="status">{{ 'common.loading' | transloco }}</td></tr>
            } @else {
              @for (r of history(); track r.id) {
                <tr [class]="ui.tr">
                  <td [class]="ui.td + ' font-medium'">{{ r.number }}</td>
                  <td [class]="ui.td">{{ r.date }}</td>
                  <td [class]="ui.td">{{ r.supplierName }}</td>
                  <td [class]="ui.td" [title]="serialsOf(r)">{{ r.lines.length }}</td>
                  <td [class]="ui.td + ' text-end'">{{ money(r.total) }}</td>
                  <td [class]="ui.td">{{ r.reason }}</td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="px-4 py-6 text-center text-slate-500">{{ 'common.empty' | transloco }}</td></tr>
              }
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class PurchaseReturnsPage implements OnInit {
  private readonly pay = inject(PayablesService);
  private readonly auth = inject(AuthStore);
  private readonly sound = inject(ScanSoundService);
  private readonly i18n = inject(TranslocoService);
  protected readonly ui = UI;
  protected readonly money = formatMoney;
  protected readonly minReason = MIN_REASON;

  protected readonly lines = signal<ReturnableSerial[]>([]);
  protected readonly history = signal<PurchaseReturn[]>([]);
  protected readonly reason = signal('');
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly scanError = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);

  protected readonly canCreate = computed(() => this.auth.can('purchase.return.create'));
  protected readonly supplierName = computed(() => this.lines()[0]?.supplierName ?? null);
  protected readonly total = computed(() => round2(this.lines().reduce((s, l) => s + l.unitCost, 0)));

  ngOnInit(): void {
    void this.loadHistory();
  }

  protected val(e: Event): string {
    return (e.target as HTMLTextAreaElement).value;
  }

  protected serialsOf(r: PurchaseReturn): string {
    return r.lines.map((l) => l.serial).join(', ');
  }

  private async loadHistory(): Promise<void> {
    this.loading.set(true);
    try {
      this.history.set(await firstValueFrom(this.pay.returns()));
    } catch {
      this.error.set(this.i18n.translate('errors.generic'));
    } finally {
      this.loading.set(false);
    }
  }

  private bad(text: string): void {
    this.scanError.set(text);
    this.sound.error();
  }

  protected async onScan(raw: string): Promise<void> {
    this.scanError.set(null);
    this.notice.set(null);
    const serial = normalizeSerial(raw);
    if (!isSerialFormatOk(serial)) return this.bad(this.i18n.translate('purchase.grn.why.invalid_format'));
    if (this.lines().some((l) => l.serial === serial)) return this.bad(this.i18n.translate('purchase.grn.why.duplicate_here'));
    try {
      const r = await firstValueFrom(this.pay.returnable(serial));
      const first = this.lines()[0];
      if (first && first.supplierId !== r.supplierId) {
        return this.bad(this.i18n.translate('purchase.payables.returns.otherSupplier', { name: first.supplierName }));
      }
      this.lines.update((l) => [...l, r]);
      this.sound.success();
    } catch (e) {
      this.bad(errorMessage(e, this.i18n.translate('errors.generic')));
    }
  }

  protected remove(serial: string): void {
    this.lines.update((l) => l.filter((x) => x.serial !== serial));
  }

  protected async submit(): Promise<void> {
    this.error.set(null);
    this.notice.set(null);
    const first = this.lines()[0];
    if (!first) return;
    if (this.reason().trim().length < MIN_REASON) {
      this.error.set(this.i18n.translate('purchase.payables.returns.reasonShort', { min: MIN_REASON }));
      return;
    }
    this.busy.set(true);
    try {
      const res = await firstValueFrom(
        this.pay.createReturn({ supplierId: first.supplierId, serials: this.lines().map((l) => l.serial), reason: this.reason().trim() }),
      );
      this.lines.set([]);
      this.reason.set('');
      this.notice.set(this.i18n.translate('purchase.payables.returns.saved', { number: res.number }));
      await this.loadHistory();
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('errors.generic')));
    } finally {
      this.busy.set(false);
    }
  }
}