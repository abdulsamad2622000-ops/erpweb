import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ScanCameraComponent } from '../../../shared/ui/scan-input/scan-camera.component';
import { ScanInputComponent } from '../../../shared/ui/scan-input/scan-input.component';
import { ScanSoundService } from '../../../shared/ui/scan-input/scan-sound.service';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { UI } from '../../purchase/utils/ui';
import { WarehouseLocation } from '../../settings/models/location.models';
import { PutAwayResult, PutAwayRow, PutAwayRowStatus } from '../models/putaway.models';
import { PutAwayService } from '../services/putaway.service';
import { OfflineQueueService } from '../services/offline-queue.service';
import { VIBRATE_ERROR, VIBRATE_OK, vibrate } from '../utils/haptics';
import { isBinCode, isPlacedHere, putAwayErrorKey } from '../utils/putaway-utils';

/**
 * Put-away: pehle bin scan, phir us bin mein rakhe jane wale items.
 * Beech mein dusra bin label scan karo to bin badal jata hai.
 * Scans ek ek karke (queue mein) chalte hain, taake tez scanner par bhi tarteeb na bigre.
 */
@Component({
  selector: 'app-scan-putaway-page',
  imports: [TranslocoPipe, ScanInputComponent, ScanCameraComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-xl space-y-4">
      <div>
        <h1 class="text-xl font-semibold">{{ 'scanApp.putaway.title' | transloco }}</h1>
        <p class="text-sm text-slate-600 dark:text-slate-400">
          {{ (bin() ? 'scanApp.putaway.itemStep' : 'scanApp.putaway.binStep') | transloco }}
        </p>
      </div>

      @if (bin(); as b) {
        <div [class]="ui.card + ' flex items-center justify-between gap-3'">
          <div class="min-w-0">
            <p class="text-xs text-slate-600 dark:text-slate-400">{{ 'scanApp.putaway.activeBin' | transloco }}</p>
            <p class="truncate text-base font-semibold"><code dir="ltr">{{ b.barcode }}</code></p>
            <p class="text-sm">{{ b.name }}</p>
          </div>
          <button type="button" class="min-h-12 shrink-0 rounded-lg border border-slate-400 px-4 text-sm" (click)="changeBin()">
            {{ 'scanApp.putaway.changeBin' | transloco }}
          </button>
        </div>
      }

      <app-scan-input
        inputId="scan-putaway"
        [showCamera]="true"
        [beep]="false"
        [disabled]="lookingUp()"
        [placeholder]="(bin() ? 'scanApp.putaway.itemPlaceholder' : 'scanApp.putaway.binPlaceholder') | transloco"
        (scanned)="onScan($event.value)"
        (cameraClick)="cameraOpen.set(true)"
      />

      @if (lookingUp()) {
        <p role="status" class="text-sm text-slate-600 dark:text-slate-400">{{ 'common.loading' | transloco }}</p>
      }
      @if (binError(); as e) {
        <p role="alert" class="rounded-xl border border-red-600 p-3 text-sm text-red-600">{{ e }}</p>
      }

      @if (bin()) {
        @if (rows().length === 0) {
          <p class="rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-700 dark:bg-slate-900">
            {{ 'scanApp.putaway.empty' | transloco }}
          </p>
        } @else {
          <div [class]="ui.card">
            <p class="mb-2 text-sm font-semibold" role="status">
              {{ 'scanApp.putaway.placed' | transloco: { n: placedCount() } }} ·
              {{ 'scanApp.putaway.failed' | transloco: { n: failedCount() } }}
            </p>
            <ul class="space-y-2">
              @for (r of rows(); track r.id) {
                <li class="flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 dark:border-slate-800">
                  <div class="min-w-0">
                    <code dir="ltr" class="text-sm">{{ r.serial }}</code>
                    <p class="text-xs text-slate-600 dark:text-slate-400">{{ r.message }}</p>
                  </div>
                  <app-status-badge
                    [label]="'scanApp.putaway.status.' + r.status | transloco"
                    [tone]="r.status === 'placed' ? 'success' : r.status === 'queued' ? 'warning' : 'danger'" />
                </li>
              }
            </ul>
          </div>
        }
        <button type="button" class="min-h-12 w-full rounded-lg bg-[#2563EB] px-4 text-sm font-medium text-white" (click)="done()">
          {{ 'scanApp.putaway.done' | transloco }}
        </button>
      }
    </section>

    @defer (when cameraOpen()) {
      <app-scan-camera
        [open]="cameraOpen()"
        [continuous]="bin() !== null"
        (detected)="onScan($event)"
        (closed)="cameraOpen.set(false)">
        @if (lastMessage(); as m) {
          <p role="status" class="mt-2 text-sm font-medium" [class]="m.ok ? 'text-green-700 dark:text-green-400' : 'text-red-600'">
            {{ m.text }}
          </p>
        }
      </app-scan-camera>
    }
  `,
})
export class ScanPutAwayPage {
  private readonly api = inject(PutAwayService);
  private readonly queue = inject(OfflineQueueService);  private readonly i18n = inject(TranslocoService);
  private readonly sound = inject(ScanSoundService);
  private readonly scanInput = viewChild.required(ScanInputComponent);

  protected readonly ui = UI;
  protected readonly bin = signal<WarehouseLocation | null>(null);
  protected readonly rows = signal<PutAwayRow[]>([]);
  protected readonly lookingUp = signal(false);
  protected readonly binError = signal<string | null>(null);
  protected readonly cameraOpen = signal(false);
  protected readonly lastMessage = signal<{ ok: boolean; text: string } | null>(null);

  protected readonly placedCount = computed(() => this.rows().filter((r) => r.status !== 'failed').length);
  protected readonly failedCount = computed(() => this.rows().filter((r) => r.status === 'failed').length);

  private nextId = 1;
  private chain: Promise<void> = Promise.resolve();

  protected onScan(code: string): void {
    const value = code.trim();
    if (!value) return;
    this.chain = this.chain.then(() => this.handle(value)).catch(() => undefined);
  }

  protected changeBin(): void {
    this.bin.set(null);
    this.binError.set(null);
    this.lastMessage.set(null);
    queueMicrotask(() => this.scanInput().focus());
  }

  protected done(): void {
    this.rows.set([]);
    this.changeBin();
  }

  private async handle(value: string): Promise<void> {
    if (!this.bin() || isBinCode(value)) {
      await this.setBin(value);
    } else {
      await this.place(value);
    }
  }

  private async setBin(code: string): Promise<void> {
    this.lookingUp.set(true);
    this.binError.set(null);
    try {
      const found = await this.api.findBin(code);
      if (found) {
        this.bin.set(found);
        this.feedback(true, found.name);
        queueMicrotask(() => this.scanInput().focus());
      } else {
        const text = this.i18n.translate('scanApp.putaway.binNotFound', { code });
        this.binError.set(text);
        this.feedback(false, text);
      }
    } catch {
      const text = this.i18n.translate('errors.generic');
      this.binError.set(text);
      this.feedback(false, text);
    } finally {
      this.lookingUp.set(false);
    }
  }

  private async place(serial: string): Promise<void> {
    const bin = this.bin();
    const barcode = bin?.barcode;
    if (!bin || !barcode) return;

    if (isPlacedHere(this.rows(), serial, barcode)) {
      this.addRow(serial, barcode, 'failed', this.i18n.translate('scanApp.putaway.duplicate'));
      return;
    }
    try {
      const r = await this.queue.run<PutAwayResult>({ kind: 'putaway', body: { bin: barcode, serial } }, serial);
      if (r.queued) {
        this.addRow(serial, barcode, 'queued', this.i18n.translate('scanApp.putaway.queued'));
      } else {
        this.addRow(r.result.serial, barcode, 'placed', this.i18n.translate('scanApp.putaway.placedIn', { bin: r.result.binName }));
      }
    } catch (e) {
      this.addRow(serial, barcode, 'failed', this.i18n.translate(putAwayErrorKey(e)));
    }
  }

  private addRow(serial: string, binBarcode: string, status: PutAwayRowStatus, message: string): void {
    this.rows.update((list) => [{ id: this.nextId++, serial, binBarcode, status, message }, ...list]);
    this.feedback(status !== 'failed', `${serial}: ${message}`);
  }

  private feedback(ok: boolean, text: string): void {
    this.lastMessage.set({ ok, text });
    if (ok) {
      this.sound.success();
      vibrate(VIBRATE_OK);
    } else {
      this.sound.error();
      vibrate(VIBRATE_ERROR);
    }
  }
}