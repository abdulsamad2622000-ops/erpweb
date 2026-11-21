import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { ScanCameraComponent } from '../../../shared/ui/scan-input/scan-camera.component';
import { ScanInputComponent } from '../../../shared/ui/scan-input/scan-input.component';
import { ScanSoundService } from '../../../shared/ui/scan-input/scan-sound.service';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { SerialDetail } from '../../inventory/models/inventory.models';
import { InventoryService } from '../../inventory/services/inventory.service';
import { STOCK_TONE } from '../../inventory/utils/inventory-ui';
import { UI } from '../../purchase/utils/ui';
import { Warehouse } from '../../settings/models/org.models';
import { WarehousesService } from '../../settings/services/org.service';
import { VIBRATE_ERROR, VIBRATE_OK, vibrate } from '../utils/haptics';

/** Quick serial lookup: scan karo, status, warehouse aur aakhri history dekho. */
@Component({
  selector: 'app-scan-lookup-page',
  imports: [RouterLink, TranslocoPipe, ScanInputComponent, ScanCameraComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-xl space-y-4">
      <div>
        <h1 class="text-xl font-semibold">{{ 'scanApp.lookup.title' | transloco }}</h1>
        <p class="text-sm text-slate-600 dark:text-slate-400">{{ 'scanApp.lookup.hint' | transloco }}</p>
      </div>

      <app-scan-input
        inputId="scan-lookup"
        [showCamera]="true"
        [beep]="false"
        [disabled]="loading()"
        [placeholder]="'scanApp.lookup.placeholder' | transloco"
        (scanned)="lookup($event.value)"
        (cameraClick)="cameraOpen.set(true)"
      />

      @if (loading()) {
        <p role="status" class="text-sm text-slate-600 dark:text-slate-400">{{ 'common.loading' | transloco }}</p>
      } @else if (error(); as e) {
        <div role="alert" class="space-y-3 rounded-xl border border-red-600 p-4">
          <p class="text-sm text-red-600">{{ e }}</p>
          <button type="button" class="min-h-12 w-full rounded-lg border border-slate-400 px-4 text-sm" (click)="retry()">
            {{ 'common.retry' | transloco }}
          </button>
        </div>
      } @else if (notFound(); as code) {
        <div role="alert" class="space-y-3 rounded-xl border border-amber-600 bg-white p-4 dark:bg-slate-900">
          <p class="text-sm font-medium text-amber-700 dark:text-amber-400">
            {{ 'scanApp.lookup.notFound' | transloco: { serial: code } }}
          </p>
          <button type="button" class="min-h-12 w-full rounded-lg bg-[#2563EB] px-4 text-sm font-medium text-white" (click)="again()">
            {{ 'scanApp.lookup.again' | transloco }}
          </button>
        </div>
      } @else if (result(); as d) {
        <div [class]="ui.card + ' space-y-4'">
          <div class="space-y-2">
            <p class="text-lg font-semibold"><code dir="ltr">{{ d.serial }}</code></p>
            <p class="text-sm">{{ d.name }}</p>
            <div class="flex flex-wrap items-center gap-2">
              <app-status-badge [label]="'inventory.status.' + d.status | transloco" [tone]="tone[d.status]" />
              @if (d.reservedRef) {
                <app-status-badge [label]="('inventory.stock.reserved' | transloco) + ' - ' + d.reservedRef" tone="info" />
              }
            </div>
          </div>

          <dl class="grid grid-cols-2 gap-3 text-sm">
            <div><dt class="text-slate-600 dark:text-slate-400">SKU</dt><dd>{{ d.sku }}</dd></div>
            <div><dt class="text-slate-600 dark:text-slate-400">{{ 'scanApp.lookup.warehouse' | transloco }}</dt><dd>{{ warehouseName(d.warehouseId) }}</dd></div>
            <div><dt class="text-slate-600 dark:text-slate-400">{{ 'purchase.orders.supplier' | transloco }}</dt><dd>{{ d.supplierName }}</dd></div>
            <div><dt class="text-slate-600 dark:text-slate-400">GRN</dt><dd>{{ d.grnNumber }}</dd></div>
            @if (d.binCode) {
              <div class="col-span-2"><dt class="text-slate-600 dark:text-slate-400">{{ 'scanApp.lookup.bin' | transloco }}</dt><dd><code dir="ltr">{{ d.binCode }}</code></dd></div>
            }
          </dl>

          @if (recent().length > 0) {
            <div>
              <h2 class="mb-2 text-sm font-semibold">{{ 'scanApp.lookup.recent' | transloco }}</h2>
              <ol class="space-y-2 border-s border-slate-300 ps-4 dark:border-slate-600">
                @for (t of recent(); track t.at + t.ref) {
                  <li>
                    <p class="text-sm font-medium">{{ 'inventory.detail.types.' + t.type | transloco }} · {{ t.ref }}</p>
                    <p class="text-xs text-slate-500">{{ t.at.slice(0, 16).replace('T', ' ') }}</p>
                  </li>
                }
              </ol>
            </div>
          }

          <div class="flex flex-col gap-2 sm:flex-row">
            <button type="button" class="min-h-12 flex-1 rounded-lg bg-[#2563EB] px-4 text-sm font-medium text-white" (click)="again()">
              {{ 'scanApp.lookup.again' | transloco }}
            </button>
            <a [routerLink]="['/inventory/serials', d.serial]" class="inline-flex min-h-12 flex-1 items-center justify-center rounded-lg border border-slate-400 px-4 text-sm">
              {{ 'scanApp.lookup.openDetail' | transloco }}
            </a>
          </div>
        </div>
      }
    </section>

    @defer (when cameraOpen()) {
      <app-scan-camera [open]="cameraOpen()" (detected)="onCamera($event)" (closed)="cameraOpen.set(false)" />
    }
  `,
})
export class ScanLookupPage implements OnInit {
  private readonly api = inject(InventoryService);
  private readonly whApi = inject(WarehousesService);
  private readonly i18n = inject(TranslocoService);
  private readonly sound = inject(ScanSoundService);
  private readonly scanInput = viewChild.required(ScanInputComponent);

  protected readonly ui = UI;
  protected readonly tone = STOCK_TONE;

  protected readonly cameraOpen = signal(false);
  protected readonly loading = signal(false);
  protected readonly result = signal<SerialDetail | null>(null);
  protected readonly notFound = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  private readonly warehouses = signal<Warehouse[]>([]);
  private lastCode = '';

  private readonly names = computed(() => new Map(this.warehouses().map((w) => [w.id, w.name] as [number, string])));
  protected readonly recent = computed(() =>
    [...(this.result()?.timeline ?? [])].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 3),
  );

  ngOnInit(): void {
    void this.loadWarehouses();
  }

  protected warehouseName(id: number): string {
    return this.names().get(id) ?? '-';
  }

  protected onCamera(code: string): void {
    this.cameraOpen.set(false);
    void this.lookup(code);
  }

  protected retry(): void {
    if (this.lastCode) void this.lookup(this.lastCode);
  }

  protected again(): void {
    this.result.set(null);
    this.notFound.set(null);
    this.error.set(null);
    queueMicrotask(() => this.scanInput().focus());
  }

  protected async lookup(code: string): Promise<void> {
    const serial = code.trim();
    if (!serial) return;
    this.lastCode = serial;
    this.loading.set(true);
    this.result.set(null);
    this.notFound.set(null);
    this.error.set(null);
    try {
      this.result.set(await firstValueFrom(this.api.serial(serial)));
      this.sound.success();
      vibrate(VIBRATE_OK);
    } catch (e) {
      if (e instanceof HttpErrorResponse && e.status === 404) {
        this.notFound.set(serial);
      } else {
        this.error.set(this.i18n.translate('errors.generic'));
      }
      this.sound.error();
      vibrate(VIBRATE_ERROR);
    } finally {
      this.loading.set(false);
    }
  }

  private async loadWarehouses(): Promise<void> {
    try {
      this.warehouses.set((await firstValueFrom(this.whApi.list({ pageSize: 500 }))).data);
    } catch {
      // Naam '-' dikhega.
    }
  }
}