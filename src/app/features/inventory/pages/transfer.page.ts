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
import { Warehouse } from '../../settings/models/org.models';
import { WarehousesService } from '../../settings/services/org.service';
import { Transfer, TransferAction, TransferLine } from '../models/transfer.models';
import { InventoryService } from '../services/inventory.service';
import { TransfersService } from '../services/transfers.service';
import { TRANSFER_TONE, canDo, missingSerials } from '../utils/transfer-utils';

const BUTTONS: TransferAction[] = ['approve', 'reject', 'dispatch', 'cancel'];
const NEEDS_APPROVE: TransferAction[] = ['approve', 'reject'];

@Component({
  selector: 'app-transfer-page',
  imports: [FormsModule, RouterLink, TranslocoPipe, ScanInputComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-5xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-3">
          <h1 class="text-xl font-semibold">{{ transfer()?.number ?? ('inventory.transfers.add' | transloco) }}</h1>
          @if (transfer(); as t) {
            <app-status-badge [label]="'inventory.transfers.status.' + t.status | transloco" [tone]="tone[t.status]" />
          }
        </div>
        <a routerLink="/inventory/transfers" [class]="ui.btn">{{ 'inventory.transfers.back' | transloco }}</a>
      </div>

      @if (notice(); as n) { <p role="status" class="rounded-lg border border-green-600 p-3 text-sm text-green-700">{{ n }}</p> }
      @if (error(); as e) { <p role="alert" class="rounded-lg border border-red-600 p-3 text-sm text-red-600">{{ e }}</p> }

      @if (isNew) {
        <div [class]="ui.card + ' space-y-3'">
          <div class="grid gap-4 sm:grid-cols-2">
            <div>
              <label for="tr-from" class="mb-1 block text-sm">{{ 'inventory.transfers.from' | transloco }} *</label>
              <select id="tr-from" [class]="ui.input" [ngModel]="from()" (ngModelChange)="setFrom(+$event)">
                <option [ngValue]="0" disabled>{{ 'inventory.transfers.pickWarehouse' | transloco }}</option>
                @for (w of warehouses(); track w.id) { <option [ngValue]="w.id">{{ w.name }}</option> }
              </select>
            </div>
            <div>
              <label for="tr-to" class="mb-1 block text-sm">{{ 'inventory.transfers.to' | transloco }} *</label>
              <select id="tr-to" [class]="ui.input" [ngModel]="to()" (ngModelChange)="to.set(+$event)">
                <option [ngValue]="0" disabled>{{ 'inventory.transfers.pickWarehouse' | transloco }}</option>
                @for (w of warehouses(); track w.id) { <option [ngValue]="w.id">{{ w.name }}</option> }
              </select>
            </div>
          </div>

          <div>
            <label for="tr-scan" class="mb-1 block text-sm font-medium">{{ 'inventory.transfers.scan' | transloco }}</label>
            <app-scan-input inputId="tr-scan" [beep]="false" [placeholder]="'inventory.transfers.scanPlaceholder' | transloco" (scanned)="onScanNew($event.value)" />
            @if (scanError(); as s) { <p role="alert" class="mt-1 text-sm text-red-600">{{ s }}</p> }
          </div>

          <div [class]="ui.tableWrap">
            <table class="w-full min-w-[30rem] text-start text-sm">
              <thead [class]="ui.thead"><tr>
                <th scope="col" [class]="ui.th">{{ 'purchase.grn.serial' | transloco }}</th>
                <th scope="col" [class]="ui.th">{{ 'inventory.stock.product' | transloco }}</th>
                <th scope="col" class="w-12"><span class="sr-only">{{ 'common.actions' | transloco }}</span></th>
              </tr></thead>
              <tbody>
                @for (l of newLines(); track l.serial) {
                  <tr [class]="ui.tr">
                    <td [class]="ui.td"><code dir="ltr">{{ l.serial }}</code></td>
                    <td [class]="ui.td">{{ l.name }}</td>
                    <td [class]="ui.td"><button type="button" class="min-h-11 min-w-11 rounded-lg text-red-600" (click)="removeNew(l.serial)" [attr.aria-label]="'common.delete' | transloco">✕</button></td>
                  </tr>
                } @empty {
                  <tr><td colspan="3" class="px-4 py-6 text-center text-slate-500">{{ 'inventory.transfers.noLines' | transloco }}</td></tr>
                }
              </tbody>
            </table>
          </div>

          <div>
            <label for="tr-note" class="mb-1 block text-sm">{{ 'purchase.grn.note' | transloco }}</label>
            <input placeholder="Enter tr note..." id="tr-note" [class]="ui.input" [ngModel]="note()" (ngModelChange)="note.set($event)" maxlength="200" />
          </div>

          <button type="button" [class]="ui.primary" [disabled]="busy() || newLines().length === 0" (click)="submitNew()">
            {{ 'inventory.transfers.submit' | transloco }}
          </button>
        </div>
      } @else if (loading()) {
        <p role="status" class="text-sm text-slate-500">{{ 'common.loading' | transloco }}</p>
      } @else if (transfer(); as t) {
        <div [class]="ui.card + ' space-y-2'">
          <dl class="grid gap-2 text-sm sm:grid-cols-3">
            <div><dt class="text-slate-600 dark:text-slate-400">{{ 'inventory.transfers.from' | transloco }}</dt><dd>{{ name(t.fromWarehouseId) }}</dd></div>
            <div><dt class="text-slate-600 dark:text-slate-400">{{ 'inventory.transfers.to' | transloco }}</dt><dd>{{ name(t.toWarehouseId) }}</dd></div>
            <div><dt class="text-slate-600 dark:text-slate-400">{{ 'inventory.transfers.createdBy' | transloco }}</dt><dd>{{ t.createdBy }}</dd></div>
          </dl>
          @if (t.note) { <p class="text-sm">{{ t.note }}</p> }
          @if (t.reason) { <p class="text-sm text-red-600">{{ 'inventory.transfers.rejectedBecause' | transloco }}: {{ t.reason }}</p> }
        </div>

        @if (missing().length > 0) {
          <div role="alert" class="rounded-lg border border-red-600 bg-red-50 p-3 text-sm text-red-800">
            <p class="font-medium">{{ 'inventory.transfers.discrepancyTitle' | transloco: { n: missing().length } }}</p>
            <p dir="ltr">{{ missing().join(', ') }}</p>
          </div>
        }

        <div [class]="ui.tableWrap">
          <table class="w-full min-w-[30rem] text-start text-sm">
            <thead [class]="ui.thead"><tr>
              <th scope="col" [class]="ui.th">{{ 'purchase.grn.serial' | transloco }}</th>
              <th scope="col" [class]="ui.th">{{ 'inventory.stock.product' | transloco }}</th>
              <th scope="col" [class]="ui.th">{{ 'inventory.transfers.arrival' | transloco }}</th>
            </tr></thead>
            <tbody>
              @for (l of t.lines; track l.serial) {
                <tr [class]="ui.tr" [class.bg-red-50]="isMissing(l.serial)">
                  <td [class]="ui.td"><code dir="ltr">{{ l.serial }}</code></td>
                  <td [class]="ui.td">{{ l.name }}</td>
                  <td [class]="ui.td">
                    @if (t.status === 'received') {
                      {{ (isMissing(l.serial) ? 'inventory.transfers.didNotArrive' : 'inventory.transfers.arrived') | transloco }}
                    } @else if (t.status === 'in_transit' && scanned().includes(l.serial)) {
                      {{ 'inventory.transfers.arrived' | transloco }}
                    } @else { - }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (t.status === 'in_transit' && can('inventory.transfer.create')) {
          <div [class]="ui.card + ' space-y-3'">
            <p class="text-sm">{{ 'inventory.transfers.receiveHint' | transloco }}</p>
            <label for="tr-recv" class="block text-sm font-medium">{{ 'inventory.transfers.scan' | transloco }}</label>
            <app-scan-input inputId="tr-recv" [beep]="false" [placeholder]="'inventory.transfers.scanPlaceholder' | transloco" (scanned)="onScanReceive($event.value)" />
            @if (scanError(); as s) { <p role="alert" class="text-sm text-red-600">{{ s }}</p> }
            <p class="text-sm" aria-live="polite">{{ 'inventory.transfers.scannedCount' | transloco: { done: scanned().length, total: t.lines.length } }}</p>
            <button type="button" [class]="ui.primary" [disabled]="busy() || scanned().length === 0" (click)="receive()">
              {{ 'inventory.transfers.completeReceipt' | transloco }}
            </button>
          </div>
        }

        <div class="flex flex-wrap gap-2">
          @for (a of buttons; track a) {
            @if (allowed(a)) {
              <button type="button" [class]="a === 'reject' || a === 'cancel' ? ui.danger : ui.primary" [disabled]="busy()" (click)="act(a)">
                {{ 'inventory.transfers.actions.' + a | transloco }}
              </button>
            }
          }
        </div>
      }
    </section>
  `,
})
export class TransferPage implements OnInit {
  private readonly api = inject(TransfersService);
  private readonly inv = inject(InventoryService);
  private readonly whApi = inject(WarehousesService);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(ConfirmDialogService);
  private readonly sound = inject(ScanSoundService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly i18n = inject(TranslocoService);
  protected readonly ui = UI;
  protected readonly tone = TRANSFER_TONE;
  protected readonly buttons = BUTTONS;
  private readonly id = Number(this.route.snapshot.paramMap.get('id')) || 0;
  protected readonly isNew = this.id === 0;

  protected readonly warehouses = signal<Warehouse[]>([]);
  protected readonly transfer = signal<Transfer | null>(null);
  protected readonly from = signal(0);
  protected readonly to = signal(0);
  protected readonly note = signal('');
  protected readonly newLines = signal<TransferLine[]>([]);
  protected readonly scanned = signal<string[]>([]);
  protected readonly loading = signal(!this.isNew);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly scanError = signal<string | null>(null);

  private readonly names = computed(() => new Map(this.warehouses().map((w) => [w.id, w.name] as [number, string])));
  protected readonly missing = computed(() => {
    const t = this.transfer();
    return t ? missingSerials(t) : [];
  });

  ngOnInit(): void {
    void this.init();
  }

  protected name(id: number): string {
    return this.names().get(id) ?? '-';
  }

  protected can(key: string): boolean {
    return this.auth.can(key);
  }

  protected isMissing(serial: string): boolean {
    return this.missing().includes(serial);
  }

  protected allowed(a: TransferAction): boolean {
    const t = this.transfer();
    if (!t || !canDo(t.status, a)) return false;
    return this.auth.can(NEEDS_APPROVE.includes(a) ? 'inventory.transfer.approve' : 'inventory.transfer.create');
  }

  private async init(): Promise<void> {
    try {
      this.warehouses.set((await firstValueFrom(this.whApi.list({ pageSize: 500 }))).data.filter((w) => w.isActive));
      if (!this.isNew) this.transfer.set(await firstValueFrom(this.api.get(this.id)));
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('errors.generic')));
    } finally {
      this.loading.set(false);
    }
  }

  protected setFrom(id: number): void {
    this.from.set(id);
    this.newLines.set([]);
  }

  private bad(text: string): void {
    this.scanError.set(text);
    this.sound.error();
  }

  protected async onScanNew(raw: string): Promise<void> {
    this.scanError.set(null);
    const serial = normalizeSerial(raw);
    if (!this.from()) return this.bad(this.i18n.translate('inventory.transfers.pickFirst'));
    if (!isSerialFormatOk(serial)) return this.bad(this.i18n.translate('purchase.grn.why.invalid_format'));
    if (this.newLines().some((l) => l.serial === serial)) return this.bad(this.i18n.translate('purchase.grn.why.duplicate_here'));
    try {
      const d = await firstValueFrom(this.inv.serial(serial));
      if (d.status !== 'in_stock') return this.bad(this.i18n.translate('inventory.transfers.notInStock'));
      if (d.warehouseId !== this.from()) return this.bad(this.i18n.translate('inventory.transfers.otherWarehouse'));
      this.newLines.update((l) => [...l, { serial: d.serial, name: d.name, sku: d.sku }]);
      this.sound.success();
    } catch (e) {
      this.bad(errorMessage(e, this.i18n.translate('errors.generic')));
    }
  }

  protected removeNew(serial: string): void {
    this.newLines.update((l) => l.filter((x) => x.serial !== serial));
  }

  protected async submitNew(): Promise<void> {
    this.error.set(null);
    if (!this.from() || !this.to()) {
      this.error.set(this.i18n.translate('inventory.transfers.pickBoth'));
      return;
    }
    if (this.from() === this.to()) {
      this.error.set(this.i18n.translate('inventory.transfers.sameWarehouse'));
      return;
    }
    await this.run(async () => {
      const t = await firstValueFrom(
        this.api.create({ fromWarehouseId: this.from(), toWarehouseId: this.to(), serials: this.newLines().map((l) => l.serial), note: this.note().trim() || null }),
      );
      await this.router.navigate(['/inventory/transfers', t.id], { replaceUrl: true });
    });
  }

  protected onScanReceive(raw: string): void {
    this.scanError.set(null);
    const t = this.transfer();
    const serial = normalizeSerial(raw);
    if (!t) return;
    if (!t.lines.some((l) => l.serial === serial)) return this.bad(this.i18n.translate('inventory.transfers.notInTransfer'));
    if (this.scanned().includes(serial)) return this.bad(this.i18n.translate('purchase.grn.why.duplicate_here'));
    this.scanned.update((s) => [...s, serial]);
    this.sound.success();
  }

  protected async act(a: TransferAction): Promise<void> {
    const t = this.transfer();
    if (!t) return;
    const titles = { number: t.number };
    if (a === 'approve') {
      const res = await this.dialogs.approve({
        title: this.i18n.translate('inventory.transfers.approveTitle', titles),
        message: this.i18n.translate('inventory.transfers.approveMessage'),
        confirmLabel: this.i18n.translate('inventory.transfers.actions.approve'),
        cancelLabel: this.i18n.translate('common.cancel'),
      });
      if (res) await this.call(a, { note: res.note });
      return;
    }
    if (a === 'reject') {
      const reason = await this.dialogs.reason({
        title: this.i18n.translate('inventory.transfers.rejectTitle'),
        message: this.i18n.translate('inventory.transfers.rejectMessage'),
        confirmLabel: this.i18n.translate('inventory.transfers.actions.reject'),
        cancelLabel: this.i18n.translate('common.cancel'),
        danger: true,
      });
      if (reason) await this.call(a, { note: reason });
      return;
    }
    const yes = await this.dialogs.confirm({
      title: this.i18n.translate(`inventory.transfers.${a}Title`, titles),
      message: this.i18n.translate(`inventory.transfers.${a}Message`),
      confirmLabel: this.i18n.translate(`inventory.transfers.actions.${a}`),
      cancelLabel: this.i18n.translate('common.cancel'),
      danger: a === 'cancel',
    });
    if (yes) await this.call(a, {});
  }

  protected async receive(): Promise<void> {
    const t = this.transfer();
    if (!t) return;
    if (this.scanned().length < t.lines.length) {
      const yes = await this.dialogs.confirm({
        title: this.i18n.translate('inventory.transfers.shortTitle'),
        message: this.i18n.translate('inventory.transfers.shortMessage', { n: t.lines.length - this.scanned().length }),
        confirmLabel: this.i18n.translate('inventory.transfers.completeReceipt'),
        cancelLabel: this.i18n.translate('common.cancel'),
        danger: true,
      });
      if (!yes) return;
    }
    await this.call('receive', { serials: this.scanned() });
  }

  private async call(a: TransferAction, body: { note?: string | null; serials?: string[] }): Promise<void> {
    await this.run(async () => {
      this.transfer.set(await firstValueFrom(this.api.action(this.id, a, body)));
      this.scanned.set([]);
      this.notice.set(this.i18n.translate('inventory.transfers.saved'));
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