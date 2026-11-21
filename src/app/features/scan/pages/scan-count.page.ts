import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogService } from '../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { ScanCameraComponent } from '../../../shared/ui/scan-input/scan-camera.component';
import { ScanInputComponent } from '../../../shared/ui/scan-input/scan-input.component';
import { ScanSoundService } from '../../../shared/ui/scan-input/scan-sound.service';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { CountLine, StockCount } from '../../inventory/models/count.models';
import { CountsService } from '../../inventory/services/counts.service';
import { InventoryService } from '../../inventory/services/inventory.service';
import { COUNT_TONE } from '../../inventory/utils/count-utils';
import { UI, errorMessage } from '../../purchase/utils/ui';
import { Warehouse } from '../../settings/models/org.models';
import { WarehousesService } from '../../settings/services/org.service';
import { OfflineCacheService } from '../services/offline-cache.service';
import { OfflineQueueService } from '../services/offline-queue.service';
import { VIBRATE_ERROR, VIBRATE_OK, vibrate } from '../utils/haptics';
import { isNetworkError } from '../utils/offline-utils';
import { checkScan, scanProblemKey } from '../utils/scan-checklist';

/**
 * Stock count: warehouse ke items scan karo. Jo expected list mein nahi woh "extra" dikhte hain.
 * Offline mein: count aur draft phone mein save rehte hain, extra serial "unverified" ke saath judta hai,
 * aur Submit queue mein jata hai.
 */
@Component({
  selector: 'app-scan-count-page',
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
      } @else if (count(); as c) {
        <div [class]="ui.card + ' space-y-1'">
          <div class="flex items-center justify-between gap-2">
            <h1 class="text-lg font-semibold">{{ c.number }}</h1>
            <app-status-badge [label]="'inventory.counts.status.' + c.status | transloco" [tone]="tone[c.status]" />
          </div>
          <p class="text-sm">{{ warehouseName() }}</p>
        </div>

        @if (message(); as m) {
          <p role="status" class="rounded-xl border border-green-600 p-3 text-sm text-green-700 dark:text-green-400">{{ m }}</p>
        }

        @if (!queued()) {
          @if (c.status !== 'open') {
            <p class="rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
              {{ 'scanApp.count.closed' | transloco }}
            </p>
          } @else {
            <p class="text-sm text-slate-600 dark:text-slate-400">{{ 'scanApp.count.hint' | transloco }}</p>

            <app-scan-input
              inputId="scan-count"
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
                {{ 'scanApp.count.progress' | transloco: { done: draft().length, total: c.expected.length } }}
              </p>
              <div class="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                <div class="h-full bg-[#16A34A]" [style.width.%]="percent()"></div>
              </div>
              @if (extraCount() > 0) {
                <p class="text-sm font-medium text-amber-700 dark:text-amber-400">
                  {{ 'scanApp.count.extraCount' | transloco: { n: extraCount() } }}
                </p>
              }
              @if (draft().length === 0) {
                <p class="text-sm text-slate-600 dark:text-slate-400">{{ 'scanApp.count.empty' | transloco }}</p>
              } @else {
                <ul class="space-y-2">
                  @for (l of draft(); track l.serial) {
                    <li class="flex items-center justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 dark:border-slate-800">
                      <div class="min-w-0">
                        <code dir="ltr" class="text-sm">{{ l.serial }}</code>
                        <p class="truncate text-xs text-slate-600 dark:text-slate-400">{{ l.name }}</p>
                      </div>
                      <div class="flex shrink-0 items-center gap-2">
                        @if (isExtra(l.serial)) {
                          <app-status-badge [label]="'scanApp.count.extra' | transloco" tone="warning" />
                        }
                        <button
                          type="button"
                          class="inline-flex h-12 w-12 items-center justify-center rounded-lg border border-slate-300 dark:border-slate-600"
                          [attr.aria-label]="'scanApp.count.remove' | transloco"
                          (click)="remove(l.serial)"
                        >
                          <i class="pi pi-times" aria-hidden="true"></i>
                        </button>
                      </div>
                    </li>
                  }
                </ul>
              }
            </div>

            <button
              type="button"
              class="min-h-12 w-full rounded-lg bg-[#2563EB] px-4 text-sm font-medium text-white disabled:opacity-50"
              [disabled]="draft().length === 0 || busy()"
              (click)="submit()"
            >
              {{ 'scanApp.count.submit' | transloco }}
            </button>
          }
        }

        <a routerLink="/scan/counts" class="inline-flex min-h-12 w-full items-center justify-center rounded-lg border border-slate-400 px-4 text-sm">
          {{ 'scanApp.count.back' | transloco }}
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
export class ScanCountPage implements OnInit {
  private readonly api = inject(CountsService);
  private readonly inv = inject(InventoryService);
  private readonly whApi = inject(WarehousesService);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(TranslocoService);
  private readonly sound = inject(ScanSoundService);
  private readonly dialogs = inject(ConfirmDialogService);
  private readonly cache = inject(OfflineCacheService);
  private readonly queue = inject(OfflineQueueService);
  private readonly scanInput = viewChild(ScanInputComponent);
  private readonly id = Number(this.route.snapshot.paramMap.get('id')) || 0;
  private readonly draftKey = `draft:count:${this.id}`;

  protected readonly ui = UI;
  protected readonly tone = COUNT_TONE;
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly stale = signal(false);
  protected readonly queued = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly scanError = signal<string | null>(null);
  protected readonly message = signal<string | null>(null);
  protected readonly cameraOpen = signal(false);
  protected readonly count = signal<StockCount | null>(null);
  protected readonly draft = signal<CountLine[]>([]);
  private readonly warehouses = signal<Warehouse[]>([]);

  private readonly expected = computed(() => this.count()?.expected.map((l) => l.serial) ?? []);
  protected readonly warehouseName = computed(
    () => this.warehouses().find((w) => w.id === this.count()?.warehouseId)?.name ?? '-',
  );
  protected readonly extraCount = computed(() => this.draft().filter((l) => !this.expected().includes(l.serial)).length);
  protected readonly percent = computed(() => {
    const total = this.count()?.expected.length ?? 0;
    const matched = this.draft().length - this.extraCount();
    return total === 0 ? 0 : Math.min(100, Math.round((matched / total) * 100));
  });

  /** Ek waqt mein ek scan, taake server check wale scans ki tarteeb na bigre. */
  private chain: Promise<void> = Promise.resolve();

  ngOnInit(): void {
    void this.load();
  }

  protected isExtra(serial: string): boolean {
    return !this.expected().includes(serial);
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [c, wh] = await Promise.all([
        this.cache.fetch(`count:${this.id}`, this.api.get(this.id)),
        this.cache.fetch('warehouses:list', this.whApi.list({ pageSize: 500 })),
      ]);
      this.warehouses.set(wh.value.data);
      this.count.set(c.value);
      this.stale.set(c.stale || wh.stale);
      const saved = await this.cache.read<CountLine[]>(this.draftKey);
      if (saved?.length && c.value.status === 'open') this.draft.set(saved);
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('errors.generic')));
    } finally {
      this.loading.set(false);
    }
  }

  protected onScan(raw: string): void {
    if (!raw.trim() || this.queued() || this.count()?.status !== 'open') return;
    this.chain = this.chain.then(() => this.handle(raw)).catch(() => undefined);
  }

  protected remove(serial: string): void {
    this.draft.update((l) => l.filter((x) => x.serial !== serial));
    this.persist();
  }

  private persist(): void {
    void this.cache.write(this.draftKey, this.draft());
  }

  private bad(text: string): void {
    this.scanError.set(text);
    this.sound.error();
    vibrate(VIBRATE_ERROR);
  }

  private async handle(raw: string): Promise<void> {
    const c = this.count();
    if (!c) return;
    this.scanError.set(null);
    const res = checkScan(
      this.expected(),
      this.draft().map((l) => l.serial),
      raw,
      true,
    );
    if (res.kind === 'invalid' || res.kind === 'duplicate') {
      return this.bad(this.i18n.translate(scanProblemKey(res.kind, '')));
    }
    if (res.kind === 'ok') {
      const line = c.expected.find((l) => l.serial === res.serial);
      if (line) this.add({ serial: line.serial, name: line.name, sku: line.sku });
      return;
    }
    // Expected nahi: server se pooch ke dekho. Network band ho to "unverified" jod do, server submit par tasdeeq karega.
    try {
      const d = await firstValueFrom(this.inv.serial(res.serial));
      this.add({ serial: d.serial, name: d.name, sku: d.sku });
    } catch (e) {
      if (isNetworkError(e)) {
        this.add({ serial: res.serial, name: this.i18n.translate('scanApp.count.unverified'), sku: '' });
      } else {
        this.bad(this.i18n.translate('inventory.counts.notFound'));
      }
    }
  }

  private add(line: CountLine): void {
    this.draft.update((l) => [line, ...l]);
    this.persist();
    this.sound.success();
    vibrate(VIBRATE_OK);
  }

  protected async submit(): Promise<void> {
    const c = this.count();
    if (!c || this.draft().length === 0) return;
    const got = new Set(this.draft().map((l) => l.serial));
    const left = c.expected.filter((e) => !got.has(e.serial)).length;
    if (left > 0) {
      const yes = await this.dialogs.confirm({
        title: this.i18n.translate('inventory.counts.shortTitle'),
        message: this.i18n.translate('inventory.counts.shortMessage', { n: left }),
        confirmLabel: this.i18n.translate('scanApp.count.submit'),
        cancelLabel: this.i18n.translate('common.cancel'),
        danger: true,
      });
      if (!yes) return;
    }
    this.busy.set(true);
    try {
      const r = await this.queue.run<StockCount>(
        { kind: 'count_submit', countId: c.id, serials: this.draft().map((l) => l.serial) },
        c.number,
      );
      if (r.queued) {
        this.queued.set(true);
        this.message.set(this.i18n.translate('scanApp.queued'));
      } else {
        this.count.set(r.result);
        this.message.set(this.i18n.translate('scanApp.count.submitted'));
      }
      this.draft.set([]);
      void this.cache.remove(this.draftKey);
      this.sound.success();
      vibrate(VIBRATE_OK);
    } catch (e) {
      this.bad(errorMessage(e, this.i18n.translate('errors.generic')));
    } finally {
      this.busy.set(false);
      queueMicrotask(() => this.scanInput()?.focus());
    }
  }
}