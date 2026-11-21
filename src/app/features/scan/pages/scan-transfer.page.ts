import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ConfirmDialogService } from '../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { ScanCameraComponent } from '../../../shared/ui/scan-input/scan-camera.component';
import { ScanInputComponent } from '../../../shared/ui/scan-input/scan-input.component';
import { ScanSoundService } from '../../../shared/ui/scan-input/scan-sound.service';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { Transfer } from '../../inventory/models/transfer.models';
import { TransfersService } from '../../inventory/services/transfers.service';
import { TRANSFER_TONE } from '../../inventory/utils/transfer-utils';
import { UI, errorMessage } from '../../purchase/utils/ui';
import { Warehouse } from '../../settings/models/org.models';
import { WarehousesService } from '../../settings/services/org.service';
import { OfflineCacheService } from '../services/offline-cache.service';
import { OfflineQueueService } from '../services/offline-queue.service';
import { VIBRATE_ERROR, VIBRATE_OK, vibrate } from '../utils/haptics';
import { checkScan, scanProblemKey } from '../utils/scan-checklist';

/**
 * Transfer par scan: approved ho to dispatch (har item check karke), in_transit ho to receive (jo pahunche unhe scan).
 * Offline mein kaam queue mein jata hai; scan ka draft phone mein save rehta hai.
 */
@Component({
  selector: 'app-scan-transfer-page',
  imports: [RouterLink, TranslocoPipe, ScanInputComponent, ScanCameraComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-xl space-y-4">
      @if (stale()) {
        <p role="status" class="rounded-xl border border-amber-600 p-3 text-sm text-amber-800 dark:text-amber-400">
          {{ 'scanApp.offlineData' | transloco }}
        </p>
      }
      @if (loading()) {
        <p role="status" class="text-sm text-slate-600 dark:text-slate-400">{{ 'common.loading' | transloco }}</p>
      } @else if (error(); as e) {
        <div role="alert" class="space-y-3 rounded-xl border border-red-600 p-4">
          <p class="text-sm text-red-600">{{ e }}</p>
          <button type="button" class="min-h-12 w-full rounded-lg border border-slate-400 px-4 text-sm" (click)="load()">
            {{ 'common.retry' | transloco }}
          </button>
        </div>
      } @else if (transfer(); as t) {
        <div [class]="ui.card + ' space-y-1'">
          <div class="flex items-center justify-between gap-2">
            <h1 class="text-lg font-semibold">{{ t.number }}</h1>
            <app-status-badge [label]="'inventory.transfers.status.' + t.status | transloco" [tone]="tone[t.status]" />
          </div>
          <p class="text-sm">{{ name(t.fromWarehouseId) }} → {{ name(t.toWarehouseId) }}</p>
        </div>

        @if (message(); as m) {
          <p role="status" class="rounded-xl border border-green-600 p-3 text-sm text-green-700 dark:text-green-400">{{ m }}</p>
        }

        @if (!queued()) {
          @if (mode() === 'none') {
            <p class="rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
              {{ 'scanApp.transfer.nothingToDo' | transloco }}
            </p>
          } @else {
            <p class="text-sm text-slate-600 dark:text-slate-400">
              {{ (mode() === 'dispatch' ? 'scanApp.transfer.dispatchHint' : 'scanApp.transfer.receiveHint') | transloco }}
            </p>

            <app-scan-input
              inputId="scan-transfer"
              [showCamera]="true"
              [beep]="false"
              [disabled]="busy()"
              [placeholder]="'scanApp.lookup.placeholder' | transloco"
              (scanned)="onScan($event.value)"
              (cameraClick)="cameraOpen.set(true)"
            />
            @if (scanError(); as s) {
              <p role="alert" class="rounded-xl border border-red-600 p-3 text-sm text-red-600">{{ s }}</p>
            }

            <div [class]="ui.card + ' space-y-3'">
              <p class="text-sm font-semibold" role="status" aria-live="polite">
                {{ 'scanApp.transfer.progress' | transloco: { done: scanned().length, total: t.lines.length } }}
              </p>
              <div class="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div class="h-full bg-[#16A34A]" [style.width.%]="percent()"></div>
              </div>
              <ul class="space-y-2">
                @for (l of t.lines; track l.serial) {
                  <li class="flex items-center gap-3">
                    <i
                      [class]="isScanned(l.serial) ? 'pi pi-check-circle text-green-600' : 'pi pi-circle text-slate-400'"
                      aria-hidden="true"
                    ></i>
                    <div class="min-w-0">
                      <code dir="ltr" class="text-sm">{{ l.serial }}</code>
                      <p class="truncate text-xs text-slate-600 dark:text-slate-400">{{ l.name }}</p>
                    </div>
                    <span class="sr-only">{{ (isScanned(l.serial) ? 'scanApp.transfer.scanned' : 'scanApp.transfer.pending') | transloco }}</span>
                  </li>
                }
              </ul>
            </div>

            <button
              type="button"
              class="min-h-12 w-full rounded-lg bg-[#2563EB] px-4 text-sm font-medium text-white disabled:opacity-50"
              [disabled]="!canComplete() || busy()"
              (click)="complete()"
            >
              {{ (mode() === 'dispatch' ? 'scanApp.transfer.dispatchBtn' : 'scanApp.transfer.receiveBtn') | transloco }}
            </button>
          }
        }

        <a routerLink="/scan/transfers" class="inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-slate-400 px-4 text-sm">
          {{ 'scanApp.transfer.back' | transloco }}
        </a>
      }
    </section>

    @defer (when cameraOpen()) {
      <app-scan-camera [open]="cameraOpen()" [continuous]="true" (detected)="onScan($event)" (closed)="cameraOpen.set(false)">
        @if (scanError(); as s) {
          <p role="alert" class="mt-2 text-sm font-medium text-red-600">{{ s }}</p>
        }
      </app-scan-camera>
    }
  `,
})
export class ScanTransferPage implements OnInit {
  private readonly api = inject(TransfersService);
  private readonly whApi = inject(WarehousesService);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(TranslocoService);
  private readonly sound = inject(ScanSoundService);
  private readonly dialogs = inject(ConfirmDialogService);
  private readonly cache = inject(OfflineCacheService);
  private readonly queue = inject(OfflineQueueService);
  private readonly scanInput = viewChild(ScanInputComponent);
  private readonly id = Number(this.route.snapshot.paramMap.get('id')) || 0;
  private readonly draftKey = `draft:transfer:${this.id}`;

  protected readonly ui = UI;
  protected readonly tone = TRANSFER_TONE;
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly stale = signal(false);
  protected readonly queued = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly scanError = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly cameraOpen = signal(false);
  protected readonly transfer = signal<Transfer | null>(null);
  protected readonly scanned = signal<string[]>([]);
  private readonly warehouses = signal<Warehouse[]>([]);
  private readonly names = computed(() => new Map(this.warehouses().map((w) => [w.id, w.name] as [number, string])));

  protected readonly mode = computed<'dispatch' | 'receive' | 'none'>(() => {
    const s = this.transfer()?.status;
    return s === 'approved' ? 'dispatch' : s === 'in_transit' ? 'receive' : 'none';
  });
  protected readonly percent = computed(() => {
    const total = this.transfer()?.lines.length ?? 0;
    return total === 0 ? 0 : Math.round((this.scanned().length / total) * 100);
  });
  protected readonly canComplete = computed(() => {
    const total = this.transfer()?.lines.length ?? 0;
    const n = this.scanned().length;
    return this.mode() === 'dispatch' ? total > 0 && n === total : n > 0;
  });

  ngOnInit(): void {
    void this.load();
  }

  protected name(id: number): string {
    return this.names().get(id) ?? '-';
  }

  protected isScanned(serial: string): boolean {
    return this.scanned().includes(serial);
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [t, wh] = await Promise.all([
        this.cache.fetch(`transfer:${this.id}`, this.api.get(this.id)),
        this.cache.fetch('warehouses:list', this.whApi.list({ pageSize: 500 })),
      ]);
      this.warehouses.set(wh.value.data);
      this.transfer.set(t.value);
      this.stale.set(t.stale || wh.stale);
      const saved = await this.cache.read<string[]>(this.draftKey);
      if (saved?.length) {
        const serials = t.value.lines.map((l) => l.serial);
        this.scanned.set(saved.filter((s) => serials.includes(s)));
      }
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('errors.generic')));
    } finally {
      this.loading.set(false);
    }
  }

  protected onScan(raw: string): void {
    const t = this.transfer();
    if (!t || this.mode() === 'none' || this.queued() || !raw.trim()) return;
    this.scanError.set(null);
    const res = checkScan(
      t.lines.map((l) => l.serial),
      this.scanned(),
      raw,
    );
    if (res.kind === 'ok') {
      this.scanned.update((l) => [res.serial, ...l]);
      void this.cache.write(this.draftKey, this.scanned());
      this.sound.success();
      vibrate(VIBRATE_OK);
      return;
    }
    this.scanError.set(this.i18n.translate(scanProblemKey(res.kind, 'scanApp.transfer.notInTransfer')));
    this.sound.error();
    vibrate(VIBRATE_ERROR);
  }

  protected async complete(): Promise<void> {
    const t = this.transfer();
    if (!t || !this.canComplete()) return;
    const dispatching = this.mode() === 'dispatch';
    if (!dispatching) {
      const missing = t.lines.length - this.scanned().length;
      if (missing > 0) {
        const yes = await this.dialogs.confirm({
          title: this.i18n.translate('scanApp.transfer.missingTitle'),
          message: this.i18n.translate('scanApp.transfer.missingMessage', { n: missing }),
          confirmLabel: this.i18n.translate('scanApp.transfer.receiveBtn'),
          cancelLabel: this.i18n.translate('common.cancel'),
          danger: true,
        });
        if (!yes) return;
      }
    }
    this.busy.set(true);
    this.scanError.set(null);
    try {
      const r = await this.queue.run<Transfer>(
        dispatching
          ? { kind: 'transfer_dispatch', transferId: t.id }
          : { kind: 'transfer_receive', transferId: t.id, serials: this.scanned() },
        t.number,
      );
      if (r.queued) {
        this.queued.set(true);
        this.message.set(this.i18n.translate('scanApp.queued'));
      } else {
        this.transfer.set(r.result);
        this.message.set(this.i18n.translate(dispatching ? 'scanApp.transfer.dispatched' : 'scanApp.transfer.received'));
      }
      this.scanned.set([]);
      void this.cache.remove(this.draftKey);
      this.sound.success();
      vibrate(VIBRATE_OK);
    } catch (e) {
      this.scanError.set(errorMessage(e, this.i18n.translate('errors.generic')));
      this.sound.error();
      vibrate(VIBRATE_ERROR);
    } finally {
      this.busy.set(false);
      queueMicrotask(() => this.scanInput()?.focus());
    }
  }
}