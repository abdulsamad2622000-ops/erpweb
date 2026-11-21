import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { ConfirmDialogService } from '../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { ScanInputComponent } from '../../../shared/ui/scan-input/scan-input.component';
import { ScanSoundService } from '../../../shared/ui/scan-input/scan-sound.service';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { isSerialFormatOk, normalizeSerial } from '../../purchase/utils/purchase-utils';
import { UI, errorMessage } from '../../purchase/utils/ui';
import { AdjustmentAction, AdjustmentKind, StockAdjustment } from '../models/adjustment.models';
import { StockStatus } from '../models/inventory.models';
import { AdjustmentsService } from '../services/adjustments.service';
import { InventoryService } from '../services/inventory.service';
import {
  ADJUSTMENT_KINDS, ADJUSTMENT_TARGET, ADJUSTMENT_TONE, MIN_REASON, canAdjust, canDoAdjustment,
} from '../utils/adjustment-utils';
import { STOCK_TONE } from '../utils/inventory-ui';

interface DraftLine {
  serial: string;
  name: string;
  sku: string;
  status: StockStatus;
  inTransit: boolean;
}

@Component({
  selector: 'app-adjustment-page',
  imports: [FormsModule, RouterLink, TranslocoPipe, ScanInputComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-5xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-3">
          <h1 class="text-xl font-semibold">{{ adj()?.number ?? ('inventory.adjustments.add' | transloco) }}</h1>
          @if (adj(); as a) {
            <app-status-badge [label]="'inventory.adjustments.status.' + a.status | transloco" [tone]="tone[a.status]" />
          }
        </div>
        <a routerLink="/inventory/adjustments" [class]="ui.btn">{{ 'inventory.adjustments.back' | transloco }}</a>
      </div>

      @if (notice(); as n) { <p role="status" class="rounded-lg border border-green-600 p-3 text-sm text-green-700">{{ n }}</p> }
      @if (error(); as e) { <p role="alert" class="rounded-lg border border-red-600 p-3 text-sm text-red-600">{{ e }}</p> }

      @if (isNew) {
        <div [class]="ui.card + ' space-y-3'">
          <div class="max-w-sm">
            <label for="adj-kind" class="mb-1 block text-sm">{{ 'inventory.adjustments.kind' | transloco }} *</label>
            <select id="adj-kind" [class]="ui.input" [ngModel]="kind()" (ngModelChange)="kind.set($event)">
              @for (k of kinds; track k) { <option [ngValue]="k">{{ 'inventory.adjustments.kinds.' + k | transloco }}</option> }
            </select>
            <p class="mt-1 text-xs text-slate-600 dark:text-slate-400">{{ 'inventory.adjustments.kindHint.' + kind() | transloco }}</p>
          </div>
          <div>
            <label for="adj-scan" class="mb-1 block text-sm font-medium">{{ 'inventory.transfers.scan' | transloco }}</label>
            <app-scan-input inputId="adj-scan" [beep]="false" [placeholder]="'inventory.transfers.scanPlaceholder' | transloco" (scanned)="onScan($event.value)" />
            @if (scanError(); as s) { <p role="alert" class="mt-1 text-sm text-red-600">{{ s }}</p> }
          </div>
        </div>

        <div [class]="ui.tableWrap">
          <table class="w-full min-w-[34rem] text-start text-sm">
            <thead [class]="ui.thead"><tr>
              <th scope="col" [class]="ui.th">{{ 'purchase.grn.serial' | transloco }}</th>
              <th scope="col" [class]="ui.th">{{ 'inventory.stock.product' | transloco }}</th>
              <th scope="col" [class]="ui.th">{{ 'inventory.adjustments.now' | transloco }}</th>
              <th scope="col" [class]="ui.th">{{ 'inventory.adjustments.after' | transloco }}</th>
              <th scope="col" class="w-12"><span class="sr-only">{{ 'common.actions' | transloco }}</span></th>
            </tr></thead>
            <tbody>
              @for (l of lines(); track l.serial) {
                <tr [class]="ui.tr">
                  <td [class]="ui.td"><code dir="ltr">{{ l.serial }}</code></td>
                  <td [class]="ui.td">{{ l.name }}</td>
                  <td [class]="ui.td"><app-status-badge [label]="'inventory.status.' + l.status | transloco" [tone]="stockTone[l.status]" /></td>
                  <td [class]="ui.td">
                    @if (bad(l)) {
                      <span class="text-xs font-medium text-red-600">{{ (l.inTransit ? 'inventory.adjustments.inTransit' : 'inventory.adjustments.notAllowed') | transloco }}</span>
                    } @else {
                      <app-status-badge [label]="'inventory.status.' + target() | transloco" [tone]="stockTone[target()]" />
                    }
                  </td>
                  <td [class]="ui.td"><button type="button" class="min-h-11 min-w-11 rounded-lg text-red-600" (click)="remove(l.serial)" [attr.aria-label]="'common.delete' | transloco">✕</button></td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="px-4 py-6 text-center text-slate-500">{{ 'inventory.adjustments.noScans' | transloco }}</td></tr>
              }
            </tbody>
          </table>
        </div>

        <div [class]="ui.card + ' space-y-2'">
          <label for="adj-reason" class="block text-sm font-medium">{{ 'inventory.adjustments.reason' | transloco }} *</label>
          <textarea id="adj-reason" rows="3" maxlength="300" [class]="ui.input + ' py-2'" [ngModel]="reason()" (ngModelChange)="reason.set($event)"></textarea>
          <p class="text-xs text-slate-600 dark:text-slate-400">{{ 'inventory.adjustments.reasonHint' | transloco: { n: minReason } }}</p>
          <p class="text-xs text-slate-600 dark:text-slate-400">{{ 'inventory.adjustments.pendingNote' | transloco }}</p>
          <button type="button" [class]="ui.primary" [disabled]="!canSend()" (click)="send()">{{ 'inventory.adjustments.send' | transloco }}</button>
        </div>
      } @else if (loading()) {
        <p role="status" class="text-sm text-slate-500">{{ 'common.loading' | transloco }}</p>
      } @else if (adj(); as a) {
        <div [class]="ui.card + ' space-y-2'">
          <dl class="grid gap-2 text-sm sm:grid-cols-3">
            <div><dt class="text-slate-600 dark:text-slate-400">{{ 'inventory.adjustments.kind' | transloco }}</dt><dd>{{ 'inventory.adjustments.kinds.' + a.kind | transloco }}</dd></div>
            <div><dt class="text-slate-600 dark:text-slate-400">{{ 'inventory.adjustments.serialsCount' | transloco }}</dt><dd>{{ a.lines.length }}</dd></div>
            <div><dt class="text-slate-600 dark:text-slate-400">{{ 'inventory.transfers.createdBy' | transloco }}</dt><dd>{{ a.createdBy }}</dd></div>
          </dl>
          <p class="text-sm"><span class="font-medium">{{ 'inventory.adjustments.reason' | transloco }}:</span> {{ a.reason }}</p>
          @if (a.status === 'rejected' && a.decisionNote) {
            <p class="text-sm text-red-600">{{ 'inventory.adjustments.rejectedBecause' | transloco }}: {{ a.decisionNote }}</p>
          }
        </div>

        <div [class]="ui.tableWrap">
          <table class="w-full min-w-[30rem] text-start text-sm">
            <thead [class]="ui.thead"><tr>
              <th scope="col" [class]="ui.th">{{ 'purchase.grn.serial' | transloco }}</th>
              <th scope="col" [class]="ui.th">{{ 'inventory.stock.product' | transloco }}</th>
              <th scope="col" [class]="ui.th">{{ 'inventory.adjustments.now' | transloco }}</th>
              <th scope="col" [class]="ui.th">{{ 'inventory.adjustments.after' | transloco }}</th>
            </tr></thead>
            <tbody>
              @for (l of a.lines; track l.serial) {
                <tr [class]="ui.tr">
                  <td [class]="ui.td"><code dir="ltr">{{ l.serial }}</code></td>
                  <td [class]="ui.td">{{ l.name }}</td>
                  <td [class]="ui.td">{{ 'inventory.status.' + l.from | transloco }}</td>
                  <td [class]="ui.td">{{ 'inventory.status.' + l.to | transloco }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (a.status === 'pending' && can('inventory.adjustment.approve')) {
          <div class="flex flex-wrap gap-2">
            @for (act of decisions; track act) {
              @if (allowed(act)) {
                <button type="button" [class]="act === 'reject' ? ui.danger : ui.primary" [disabled]="busy()" (click)="decide(act)">
                  {{ 'inventory.adjustments.actions.' + act | transloco }}
                </button>
              }
            }
          </div>
        }
      }
    </section>
  `,
})
export class AdjustmentPage implements OnInit {
  private readonly api = inject(AdjustmentsService);
  private readonly inv = inject(InventoryService);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(ConfirmDialogService);
  private readonly sound = inject(ScanSoundService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly i18n = inject(TranslocoService);
  protected readonly ui = UI;
  protected readonly tone = ADJUSTMENT_TONE;
  protected readonly stockTone = STOCK_TONE;
  protected readonly kinds = ADJUSTMENT_KINDS;
  protected readonly minReason = MIN_REASON;
  protected readonly decisions: AdjustmentAction[] = ['approve', 'reject'];
  private readonly id = Number(this.route.snapshot.paramMap.get('id')) || 0;
  protected readonly isNew = this.id === 0;

  protected readonly adj = signal<StockAdjustment | null>(null);
  protected readonly kind = signal<AdjustmentKind>('quarantine');
  protected readonly lines = signal<DraftLine[]>([]);
  protected readonly reason = signal('');
  protected readonly loading = signal(!this.isNew);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly scanError = signal<string | null>(null);

  protected readonly target = computed(() => ADJUSTMENT_TARGET[this.kind()]);
  protected readonly canSend = computed(
    () =>
      !this.busy() &&
      this.lines().length > 0 &&
      this.lines().every((l) => !this.bad(l)) &&
      this.reason().trim().length >= MIN_REASON,
  );

  ngOnInit(): void {
    if (!this.isNew) void this.load();
  }

  protected can(key: string): boolean {
    return this.auth.can(key);
  }

  protected allowed(a: AdjustmentAction): boolean {
    const x = this.adj();
    return !!x && canDoAdjustment(x.status, a);
  }

  /** Is serial par abhi ye kaam nahi ho sakta (galat status ya raaste mein). */
  protected bad(l: DraftLine): boolean {
    return l.inTransit || !canAdjust(l.status, this.kind());
  }

  private async load(): Promise<void> {
    try {
      this.adj.set(await firstValueFrom(this.api.get(this.id)));
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('errors.generic')));
    } finally {
      this.loading.set(false);
    }
  }

  private fail(text: string): void {
    this.scanError.set(text);
    this.sound.error();
  }

  protected async onScan(raw: string): Promise<void> {
    this.scanError.set(null);
    const serial = normalizeSerial(raw);
    if (!isSerialFormatOk(serial)) return this.fail(this.i18n.translate('purchase.grn.why.invalid_format'));
    if (this.lines().some((l) => l.serial === serial)) return this.fail(this.i18n.translate('purchase.grn.why.duplicate_here'));
    try {
      const d = await firstValueFrom(this.inv.serial(serial));
      this.lines.update((l) => [...l, { serial: d.serial, name: d.name, sku: d.sku, status: d.status, inTransit: d.warehouseId === 0 }]);
      this.sound.success();
    } catch {
      this.fail(this.i18n.translate('inventory.counts.notFound'));
    }
  }

  protected remove(serial: string): void {
    this.lines.update((l) => l.filter((x) => x.serial !== serial));
  }

  protected async send(): Promise<void> {
    await this.run(async () => {
      const a = await firstValueFrom(
        this.api.create({ kind: this.kind(), serials: this.lines().map((l) => l.serial), reason: this.reason().trim() }),
      );
      await this.router.navigate(['/inventory/adjustments', a.id], { replaceUrl: true });
    });
  }

  protected async decide(a: AdjustmentAction): Promise<void> {
    const x = this.adj();
    if (!x) return;
    if (a === 'approve') {
      const res = await this.dialogs.approve({
        title: this.i18n.translate('inventory.adjustments.approveTitle', { number: x.number }),
        message: this.i18n.translate('inventory.adjustments.approveMessage'),
        confirmLabel: this.i18n.translate('inventory.adjustments.actions.approve'),
        cancelLabel: this.i18n.translate('common.cancel'),
      });
      if (res) await this.call('approve', { note: res.note });
      return;
    }
    const reason = await this.dialogs.reason({
      title: this.i18n.translate('inventory.adjustments.rejectTitle'),
      message: this.i18n.translate('inventory.adjustments.rejectMessage'),
      confirmLabel: this.i18n.translate('inventory.adjustments.actions.reject'),
      cancelLabel: this.i18n.translate('common.cancel'),
      danger: true,
    });
    if (reason) await this.call('reject', { note: reason });
  }

  private async call(a: AdjustmentAction, body: { note?: string | null }): Promise<void> {
    await this.run(async () => {
      this.adj.set(await firstValueFrom(this.api.action(this.id, a, body)));
      this.notice.set(this.i18n.translate('inventory.adjustments.saved'));
    });
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      await fn();
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('errors.generic')));
    } finally {
      this.busy.set(false);
    }
  }
}