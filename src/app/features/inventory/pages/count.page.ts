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
import { CountAction, CountLine, StockCount } from '../models/count.models';
import { CountsService } from '../services/counts.service';
import { InventoryService } from '../services/inventory.service';
import { COUNT_TONE, canDoCount, variance } from '../utils/count-utils';

@Component({
  selector: 'app-count-page',
  imports: [FormsModule, RouterLink, TranslocoPipe, ScanInputComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-5xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-3">
          <h1 class="text-xl font-semibold">{{ count()?.number ?? ('inventory.counts.add' | transloco) }}</h1>
          @if (count(); as c) {
            <app-status-badge [label]="'inventory.counts.status.' + c.status | transloco" [tone]="tone[c.status]" />
          }
        </div>
        <a routerLink="/inventory/counts" [class]="ui.btn">{{ 'inventory.counts.back' | transloco }}</a>
      </div>

      @if (notice(); as n) { <p role="status" class="rounded-lg border border-green-600 p-3 text-sm text-green-700">{{ n }}</p> }
      @if (error(); as e) { <p role="alert" class="rounded-lg border border-red-600 p-3 text-sm text-red-600">{{ e }}</p> }

      @if (isNew) {
        <div [class]="ui.card + ' space-y-3'">
          <div class="max-w-sm">
            <label for="cn-wh" class="mb-1 block text-sm">{{ 'inventory.counts.warehouse' | transloco }} *</label>
            <select id="cn-wh" [class]="ui.input" [ngModel]="warehouseId()" (ngModelChange)="warehouseId.set(+$event)">
              <option [ngValue]="0" disabled>{{ 'inventory.counts.pickWarehouse' | transloco }}</option>
              @for (w of warehouses(); track w.id) { <option [ngValue]="w.id">{{ w.name }}</option> }
            </select>
          </div>
          <div>
            <label for="cn-note" class="mb-1 block text-sm">{{ 'purchase.grn.note' | transloco }}</label>
            <input id="cn-note" [class]="ui.input" [ngModel]="note()" (ngModelChange)="note.set($event)" maxlength="200" />
          </div>
          <button type="button" [class]="ui.primary" [disabled]="busy() || !warehouseId()" (click)="start()">
            {{ 'inventory.counts.start' | transloco }}
          </button>
        </div>
      } @else if (loading()) {
        <p role="status" class="text-sm text-slate-500">{{ 'common.loading' | transloco }}</p>
      } @else if (count(); as c) {
        <div [class]="ui.card + ' space-y-2'">
          <dl class="grid gap-2 text-sm sm:grid-cols-3">
            <div><dt class="text-slate-600 dark:text-slate-400">{{ 'inventory.counts.warehouse' | transloco }}</dt><dd>{{ name(c.warehouseId) }}</dd></div>
            <div><dt class="text-slate-600 dark:text-slate-400">{{ 'inventory.counts.expected' | transloco }}</dt><dd>{{ c.expected.length }}</dd></div>
            <div><dt class="text-slate-600 dark:text-slate-400">{{ 'inventory.transfers.createdBy' | transloco }}</dt><dd>{{ c.createdBy }}</dd></div>
          </dl>
          @if (c.note) { <p class="text-sm">{{ c.note }}</p> }
          @if (c.reason) { <p class="text-sm text-red-600">{{ 'inventory.counts.rejectedBecause' | transloco }}: {{ c.reason }}</p> }
        </div>

        @if (c.status === 'open') {
          @if (can('inventory.count.create')) {
            <div [class]="ui.card + ' space-y-3'">
              <p class="text-sm">{{ 'inventory.counts.scanHint' | transloco }}</p>
              <label for="cn-scan" class="block text-sm font-medium">{{ 'inventory.transfers.scan' | transloco }}</label>
              <app-scan-input inputId="cn-scan" [beep]="false" [placeholder]="'inventory.transfers.scanPlaceholder' | transloco" (scanned)="onScan($event.value)" />
              @if (scanError(); as s) { <p role="alert" class="text-sm text-red-600">{{ s }}</p> }
              <p class="text-sm" aria-live="polite">{{ 'inventory.counts.scannedCount' | transloco: { done: draft().length, total: c.expected.length } }}</p>
            </div>

            <div [class]="ui.tableWrap">
              <table class="w-full min-w-[30rem] text-start text-sm">
                <thead [class]="ui.thead"><tr>
                  <th scope="col" [class]="ui.th">{{ 'purchase.grn.serial' | transloco }}</th>
                  <th scope="col" [class]="ui.th">{{ 'inventory.stock.product' | transloco }}</th>
                  <th scope="col" class="w-12"><span class="sr-only">{{ 'common.actions' | transloco }}</span></th>
                </tr></thead>
                <tbody>
                  @for (l of draft(); track l.serial) {
                    <tr [class]="ui.tr">
                      <td [class]="ui.td"><code dir="ltr">{{ l.serial }}</code></td>
                      <td [class]="ui.td">{{ l.name }}</td>
                      <td [class]="ui.td"><button type="button" class="min-h-11 min-w-11 rounded-lg text-red-600" (click)="remove(l.serial)" [attr.aria-label]="'common.delete' | transloco">✕</button></td>
                    </tr>
                  } @empty {
                    <tr><td colspan="3" class="px-4 py-6 text-center text-slate-500">{{ 'inventory.counts.noScans' | transloco }}</td></tr>
                  }
                </tbody>
              </table>
            </div>

            <button type="button" [class]="ui.primary" [disabled]="busy() || draft().length === 0" (click)="submit()">
              {{ 'inventory.counts.submit' | transloco }}
            </button>
          }
        } @else {
          <div [class]="ui.card + ' space-y-2'">
            <h2 class="text-base font-semibold">{{ 'inventory.counts.varianceTitle' | transloco }}</h2>
            <p class="text-sm">{{ 'inventory.counts.matched' | transloco: { n: diff().matched } }}</p>
            @if (diff().missing.length === 0 && diff().extra.length === 0) {
              <p class="text-sm text-green-700">{{ 'inventory.counts.noVariance' | transloco }}</p>
            }
          </div>

          @if (diff().missing.length > 0) {
            <div role="alert" class="rounded-lg border border-red-600 bg-red-50 p-3 text-sm text-red-800">
              <p class="mb-2 font-medium">{{ 'inventory.counts.missingTitle' | transloco: { n: diff().missing.length } }}</p>
              <ul class="space-y-1">
                @for (l of diff().missing; track l.serial) {
                  <li><code dir="ltr">{{ l.serial }}</code> · {{ l.name }}</li>
                }
              </ul>
            </div>
          }
          @if (diff().extra.length > 0) {
            <div class="rounded-lg border border-amber-600 bg-amber-50 p-3 text-sm text-amber-900">
              <p class="mb-1 font-medium">{{ 'inventory.counts.extraTitle' | transloco: { n: diff().extra.length } }}</p>
              <p class="mb-2 text-xs">{{ 'inventory.counts.extraHint' | transloco }}</p>
              <ul class="space-y-1">
                @for (l of diff().extra; track l.serial) {
                  <li><code dir="ltr">{{ l.serial }}</code> · {{ l.name }}</li>
                }
              </ul>
            </div>
          }

          @if (c.status === 'submitted' && can('inventory.count.approve')) {
            <p class="text-sm text-slate-600 dark:text-slate-400">{{ 'inventory.counts.approveHint' | transloco }}</p>
            <div class="flex flex-wrap gap-2">
              @for (a of decisions; track a) {
                @if (allowed(a)) {
                  <button type="button" [class]="a === 'reject' ? ui.danger : ui.primary" [disabled]="busy()" (click)="decide(a)">
                    {{ 'inventory.counts.actions.' + a | transloco }}
                  </button>
                }
              }
            </div>
          }
        }
      }
    </section>
  `,
})
export class CountPage implements OnInit {
  private readonly api = inject(CountsService);
  private readonly inv = inject(InventoryService);
  private readonly whApi = inject(WarehousesService);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(ConfirmDialogService);
  private readonly sound = inject(ScanSoundService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly i18n = inject(TranslocoService);
  protected readonly ui = UI;
  protected readonly tone = COUNT_TONE;
  protected readonly decisions: CountAction[] = ['approve', 'reject'];
  private readonly id = Number(this.route.snapshot.paramMap.get('id')) || 0;
  protected readonly isNew = this.id === 0;

  protected readonly warehouses = signal<Warehouse[]>([]);
  protected readonly count = signal<StockCount | null>(null);
  protected readonly warehouseId = signal(0);
  protected readonly note = signal('');
  protected readonly draft = signal<CountLine[]>([]);
  protected readonly loading = signal(!this.isNew);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly scanError = signal<string | null>(null);

  private readonly names = computed(() => new Map(this.warehouses().map((w) => [w.id, w.name] as [number, string])));
  protected readonly diff = computed(() => {
    const c = this.count();
    return c ? variance(c) : { missing: [], extra: [], matched: 0 };
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

  protected allowed(a: CountAction): boolean {
    const c = this.count();
    return !!c && canDoCount(c.status, a);
  }

  private async init(): Promise<void> {
    try {
      const all = (await firstValueFrom(this.whApi.list({ pageSize: 500 }))).data;
      this.warehouses.set(this.isNew ? all.filter((w) => w.isActive) : all);
      if (!this.isNew) this.count.set(await firstValueFrom(this.api.get(this.id)));
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('errors.generic')));
    } finally {
      this.loading.set(false);
    }
  }

  private bad(text: string): void {
    this.scanError.set(text);
    this.sound.error();
  }

  protected async start(): Promise<void> {
    await this.run(async () => {
      const c = await firstValueFrom(this.api.create({ warehouseId: this.warehouseId(), note: this.note().trim() || null }));
      await this.router.navigate(['/inventory/counts', c.id], { replaceUrl: true });
    });
  }

  protected async onScan(raw: string): Promise<void> {
    this.scanError.set(null);
    const serial = normalizeSerial(raw);
    if (!isSerialFormatOk(serial)) return this.bad(this.i18n.translate('purchase.grn.why.invalid_format'));
    if (this.draft().some((l) => l.serial === serial)) return this.bad(this.i18n.translate('purchase.grn.why.duplicate_here'));
    try {
      const d = await firstValueFrom(this.inv.serial(serial));
      this.draft.update((l) => [...l, { serial: d.serial, name: d.name, sku: d.sku }]);
      this.sound.success();
    } catch {
      this.bad(this.i18n.translate('inventory.counts.notFound'));
    }
  }

  protected remove(serial: string): void {
    this.draft.update((l) => l.filter((x) => x.serial !== serial));
  }

  protected async submit(): Promise<void> {
    const c = this.count();
    if (!c) return;
    const left = c.expected.filter((e) => !this.draft().some((d) => d.serial === e.serial)).length;
    if (left > 0) {
      const yes = await this.dialogs.confirm({
        title: this.i18n.translate('inventory.counts.shortTitle'),
        message: this.i18n.translate('inventory.counts.shortMessage', { n: left }),
        confirmLabel: this.i18n.translate('inventory.counts.submit'),
        cancelLabel: this.i18n.translate('common.cancel'),
        danger: true,
      });
      if (!yes) return;
    }
    await this.call('submit', { serials: this.draft().map((l) => l.serial) });
  }

  protected async decide(a: CountAction): Promise<void> {
    const c = this.count();
    if (!c) return;
    if (a === 'approve') {
      const res = await this.dialogs.approve({
        title: this.i18n.translate('inventory.counts.approveTitle', { number: c.number }),
        message: this.i18n.translate('inventory.counts.approveMessage'),
        confirmLabel: this.i18n.translate('inventory.counts.actions.approve'),
        cancelLabel: this.i18n.translate('common.cancel'),
      });
      if (res) await this.call('approve', { note: res.note });
      return;
    }
    const reason = await this.dialogs.reason({
      title: this.i18n.translate('inventory.counts.rejectTitle'),
      message: this.i18n.translate('inventory.counts.rejectMessage'),
      confirmLabel: this.i18n.translate('inventory.counts.actions.reject'),
      cancelLabel: this.i18n.translate('common.cancel'),
      danger: true,
    });
    if (reason) await this.call('reject', { note: reason });
  }

  private async call(a: CountAction, body: { note?: string | null; serials?: string[] }): Promise<void> {
    await this.run(async () => {
      this.count.set(await firstValueFrom(this.api.action(this.id, a, body)));
      this.draft.set([]);
      this.notice.set(this.i18n.translate('inventory.counts.saved'));
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