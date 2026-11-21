import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { ScanInputComponent } from '../../../shared/ui/scan-input/scan-input.component';
import { ScanSoundService } from '../../../shared/ui/scan-input/scan-sound.service';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { isSerialFormatOk, normalizeSerial } from '../../purchase/utils/purchase-utils';
import { UI, errorMessage } from '../../purchase/utils/ui';
import { WarehouseLocation } from '../../settings/models/location.models';
import { LocationsService } from '../../settings/services/org.service';
import { pathOf } from '../../settings/utils/location-utils';
import { StockStatus } from '../models/inventory.models';
import { InventoryService } from '../services/inventory.service';
import { PutawayService } from '../services/putaway.service';
import { STOCK_TONE } from '../utils/inventory-ui';
import { loadAll } from '../utils/load-all';

interface Line {
  serial: string;
  name: string;
  status: StockStatus;
}

@Component({
  selector: 'app-putaway-page',
  imports: [RouterLink, TranslocoPipe, ScanInputComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-4xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">{{ 'binsPage.putaway.title' | transloco }}</h1>
        <a routerLink="/inventory/locations" [class]="ui.btn">{{ 'binsPage.putaway.back' | transloco }}</a>
      </div>

      @if (notice(); as n) { <p role="status" class="rounded-lg border border-green-600 p-3 text-sm text-green-700">{{ n }}</p> }
      @if (error(); as e) { <p role="alert" class="rounded-lg border border-red-600 p-3 text-sm text-red-600">{{ e }}</p> }

      @if (loading()) {
        <p role="status" class="text-sm text-slate-500">{{ 'common.loading' | transloco }}</p>
      } @else {
        <div [class]="ui.card + ' space-y-3'">
          @if (bin(); as b) {
            <div class="flex flex-wrap items-center justify-between gap-2">
              <p class="text-sm">
                <span class="font-medium">{{ 'binsPage.putaway.binSelected' | transloco }}:</span>
                <code dir="ltr">{{ b.barcode }}</code>
                <span class="text-slate-600 dark:text-slate-400">{{ binPath() }}</span>
              </p>
              <button type="button" [class]="ui.btn" [disabled]="lines().length > 0" (click)="changeBin()">
                {{ 'binsPage.putaway.changeBin' | transloco }}
              </button>
            </div>
            <p class="text-sm text-slate-600 dark:text-slate-400">{{ 'binsPage.putaway.step2' | transloco }}</p>
          } @else {
            <p class="text-sm text-slate-600 dark:text-slate-400">{{ 'binsPage.putaway.step1' | transloco }}</p>
          }
          <div>
            <label for="put-scan" class="mb-1 block text-sm font-medium">{{ 'binsPage.putaway.scanLabel' | transloco }}</label>
            <app-scan-input inputId="put-scan" [beep]="false" [placeholder]="'inventory.transfers.scanPlaceholder' | transloco" (scanned)="onScan($event.value)" />
            @if (scanError(); as s) { <p role="alert" class="mt-1 text-sm text-red-600">{{ s }}</p> }
          </div>
        </div>

        @if (bin()) {
          <div [class]="ui.tableWrap">
            <table class="w-full min-w-[30rem] text-start text-sm">
              <caption class="sr-only">{{ 'binsPage.serials' | transloco }}</caption>
              <thead [class]="ui.thead"><tr>
                <th scope="col" [class]="ui.th">{{ 'purchase.grn.serial' | transloco }}</th>
                <th scope="col" [class]="ui.th">{{ 'binsPage.product' | transloco }}</th>
                <th scope="col" [class]="ui.th">{{ 'purchase.statusCol' | transloco }}</th>
                <th scope="col" class="w-12"><span class="sr-only">{{ 'common.actions' | transloco }}</span></th>
              </tr></thead>
              <tbody>
                @for (l of lines(); track l.serial) {
                  <tr [class]="ui.tr">
                    <td [class]="ui.td"><code dir="ltr">{{ l.serial }}</code></td>
                    <td [class]="ui.td">{{ l.name }}</td>
                    <td [class]="ui.td"><app-status-badge [label]="'inventory.status.' + l.status | transloco" [tone]="stockTone[l.status]" /></td>
                    <td [class]="ui.td"><button type="button" class="min-h-11 min-w-11 rounded-lg text-red-600" (click)="remove(l.serial)" [attr.aria-label]="'common.delete' | transloco">✕</button></td>
                  </tr>
                } @empty {
                  <tr><td colspan="4" class="px-4 py-6 text-center text-slate-500">{{ 'binsPage.putaway.noScans' | transloco }}</td></tr>
                }
              </tbody>
            </table>
          </div>
          <button type="button" [class]="ui.primary" [disabled]="busy() || lines().length === 0" (click)="save()">
            {{ 'binsPage.putaway.save' | transloco }}
          </button>
        }
      }
    </section>
  `,
})
export class PutawayPage implements OnInit {
  private readonly locApi = inject(LocationsService);
  private readonly inv = inject(InventoryService);
  private readonly api = inject(PutawayService);
  private readonly sound = inject(ScanSoundService);
  private readonly i18n = inject(TranslocoService);
  protected readonly ui = UI;
  protected readonly stockTone = STOCK_TONE;

  private readonly allLocations = signal<WarehouseLocation[]>([]);
  protected readonly bin = signal<WarehouseLocation | null>(null);
  protected readonly lines = signal<Line[]>([]);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly scanError = signal<string | null>(null);

  private readonly bins = computed(() => this.allLocations().filter((l) => l.level === 'bin' && l.isActive && !!l.barcode));
  protected readonly binPath = computed(() => {
    const b = this.bin();
    if (!b) return '';
    const rows = this.allLocations().filter((l) => l.warehouseId === b.warehouseId);
    return pathOf(rows, b).map((p) => p.code).join(' / ');
  });

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.allLocations.set(await loadAll(this.locApi));
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('binsPage.putaway.loadFailed')));
    } finally {
      this.loading.set(false);
    }
  }

  private fail(text: string): void {
    this.scanError.set(text);
    this.sound.error();
  }

  protected changeBin(): void {
    this.bin.set(null);
    this.scanError.set(null);
  }

  protected remove(serial: string): void {
    this.lines.update((l) => l.filter((x) => x.serial !== serial));
  }

  protected async onScan(raw: string): Promise<void> {
    this.scanError.set(null);
    this.notice.set(null);
    const code = normalizeSerial(raw);

    const found = this.bins().find((b) => (b.barcode ?? '').toUpperCase() === code);
    if (found) {
      if (this.lines().length > 0) return this.fail(this.i18n.translate('binsPage.putaway.finishFirst'));
      this.bin.set(found);
      this.sound.success();
      return;
    }

    const bin = this.bin();
    if (!bin) return this.fail(this.i18n.translate('binsPage.putaway.binNotFound'));
    if (!isSerialFormatOk(code)) return this.fail(this.i18n.translate('purchase.grn.why.invalid_format'));
    if (this.lines().some((l) => l.serial === code)) return this.fail(this.i18n.translate('purchase.grn.why.duplicate_here'));

    try {
      const d = await firstValueFrom(this.inv.serial(code));
      if (d.warehouseId === 0) return this.fail(this.i18n.translate('binsPage.putaway.inTransit'));
      if (d.warehouseId !== bin.warehouseId) return this.fail(this.i18n.translate('binsPage.putaway.otherWarehouse'));
      if (d.status === 'returned') return this.fail(this.i18n.translate('binsPage.putaway.notInStore'));
      if (d.binId === bin.id) return this.fail(this.i18n.translate('binsPage.putaway.alreadyHere'));
      this.lines.update((l) => [...l, { serial: d.serial, name: d.name, status: d.status }]);
      this.sound.success();
    } catch {
      this.fail(this.i18n.translate('inventory.counts.notFound'));
    }
  }

  protected async save(): Promise<void> {
    const b = this.bin();
    if (!b || !b.barcode || this.lines().length === 0) return;
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      const r = await firstValueFrom(
        this.api.putaway({ binBarcode: b.barcode, serials: this.lines().map((l) => l.serial) }),
      );
      this.notice.set(this.i18n.translate('binsPage.putaway.saved', { n: r.moved, bin: b.barcode }));
      this.lines.set([]);
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('errors.generic')));
    } finally {
      this.busy.set(false);
    }
  }
}