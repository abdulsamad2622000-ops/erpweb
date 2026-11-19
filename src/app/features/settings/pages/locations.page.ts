import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { ConfirmDialogService } from '../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { CrudDialogComponent } from '../../../shared/ui/crud-dialog/crud-dialog.component';
import { FormFieldComponent } from '../../../shared/ui/form-field/form-field.component';
import { PrintService } from '../../../shared/ui/print/print.service';
import { LocationLevel, WarehouseLocation } from '../models/location.models';
import { Warehouse } from '../models/org.models';
import { WarehousesService } from '../services/org.service';
import { LocationsStore } from '../stores/org.stores';
import { code128Svg } from '../utils/barcode-svg';
import { BinLabel, buildBinLabelSheet } from '../utils/bin-label';
import { flattenTree, nextLevel, pathOf } from '../utils/location-utils';

@Component({
  selector: 'app-locations-page',
  imports: [ReactiveFormsModule, TranslocoPipe, CrudDialogComponent, FormFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4">
      <div class="flex flex-wrap items-end gap-3">
        <div class="min-w-56 flex-1">
          <label for="loc-warehouse" class="mb-1 block text-sm font-medium">
            {{ 'settingsLocations.warehouse' | transloco }}
          </label>
          <select
            id="loc-warehouse"
            class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm"
            (change)="onWarehouse($event)"
          >
            <option value="" [selected]="warehouseId() === null">
              {{ 'settingsLocations.chooseWarehouse' | transloco }}
            </option>
            @for (w of warehouses(); track w.id) {
              <option [value]="w.id" [selected]="w.id === warehouseId()">{{ w.code }} - {{ w.name }}</option>
            }
          </select>
        </div>

        @if (warehouseId() !== null && auth.can('settings.manage')) {
          <button
            type="button"
            class="min-h-12 rounded-lg bg-[#2563EB] px-5 font-medium text-white"
            (click)="openAdd(null)"
          >
            {{ 'settingsLocations.addZone' | transloco }}
          </button>
        }
        @if (bins().length > 0) {
          <button
            type="button"
            class="min-h-12 rounded-lg border border-slate-400 px-5 font-medium"
            (click)="printLabels()"
          >
            @if (selected().size > 0) {
              {{ 'settingsLocations.printSelected' | transloco: { count: selected().size } }}
            } @else {
              {{ 'settingsLocations.printLabels' | transloco }}
            }
          </button>
        }
      </div>

      @if (actionError(); as msg) {
        <p role="alert" class="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-[#DC2626] dark:bg-transparent">
          {{ msg }}
        </p>
      }

      @if (warehouseId() === null) {
        <p class="text-sm text-[#5B6679]">{{ 'settingsLocations.noWarehouse' | transloco }}</p>
      } @else if (loadError(); as msg) {
        <div role="alert" class="space-y-3 rounded-lg border border-red-300 p-4">
          <p class="text-sm text-[#DC2626]">{{ msg }}</p>
          <button type="button" class="min-h-11 rounded-lg border border-slate-400 px-4" (click)="reload()">
            {{ 'settingsLocations.retry' | transloco }}
          </button>
        </div>
      } @else if (store.loading() && store.rows().length === 0) {
        <p role="status" class="text-sm text-[#5B6679]">{{ 'settingsLocations.loading' | transloco }}</p>
      } @else if (tree().length === 0) {
        <p class="text-sm text-[#5B6679]">{{ 'settingsLocations.empty' | transloco }}</p>
      } @else {
        <ul class="space-y-2">
          @for (t of tree(); track t.row.id) {
            <li
              class="flex flex-wrap items-center gap-2 rounded-[10px] border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
              [style.margin-inline-start.rem]="t.depth * 1.5"
            >
              @if (t.hasChildren) {
                <button
                  type="button"
                  class="inline-flex size-11 items-center justify-center rounded-lg"
                  [attr.aria-expanded]="!collapsed().has(t.row.id)"
                  [attr.aria-label]="(collapsed().has(t.row.id) ? 'settingsLocations.expand' : 'settingsLocations.collapse') | transloco"
                  (click)="toggle(t.row.id)"
                >
                  <i [class]="collapsed().has(t.row.id) ? 'pi pi-chevron-right rtl:rotate-180' : 'pi pi-chevron-down'" aria-hidden="true"></i>
                </button>
              } @else if (t.row.level === 'bin') {
                <input
                  type="checkbox"
                  class="size-5"
                  [checked]="selected().has(t.row.id)"
                  [attr.aria-label]="'settingsLocations.selectBin' | transloco: { name: t.row.name }"
                  (change)="toggleSelect(t.row.id, $event)"
                />
              } @else {
                <span class="inline-block size-11" aria-hidden="true"></span>
              }

              <span class="font-medium" dir="ltr">{{ t.row.code }}</span>
              <span>{{ t.row.name }}</span>
              <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-[#5B6679] dark:bg-slate-800">
                {{ 'settingsLocations.levels.' + t.row.level | transloco }}
              </span>
              @if (t.row.barcode) {
                <code class="text-xs text-[#5B6679]" dir="ltr">{{ t.row.barcode }}</code>
              }
              @if (!t.row.isActive) {
                <span class="text-xs text-[#D97706]">{{ 'common.status.inactive' | transloco }}</span>
              }

              <span class="ms-auto flex items-center gap-1">
                @if (t.row.level === 'bin') {
                  <button
                    type="button"
                    class="inline-flex size-11 items-center justify-center rounded-lg"
                    [attr.aria-label]="'settingsLocations.printOne' | transloco"
                    (click)="printLabels([t.row])"
                  >
                    <i class="pi pi-print" aria-hidden="true"></i>
                  </button>
                }
                @if (auth.can('settings.manage')) {
                  @if (t.row.level !== 'bin') {
                    <button
                      type="button"
                      class="inline-flex size-11 items-center justify-center rounded-lg"
                      [attr.aria-label]="'settingsLocations.addChild' | transloco: { level: childName(t.row) }"
                      (click)="openAdd(t.row)"
                    >
                      <i class="pi pi-plus" aria-hidden="true"></i>
                    </button>
                  }
                  <button
                    type="button"
                    class="inline-flex size-11 items-center justify-center rounded-lg"
                    [attr.aria-label]="'common.edit' | transloco"
                    (click)="openEdit(t.row)"
                  >
                    <i class="pi pi-pencil" aria-hidden="true"></i>
                  </button>
                  <button
                    type="button"
                    class="inline-flex size-11 items-center justify-center rounded-lg text-[#DC2626]"
                    [attr.aria-label]="'common.delete' | transloco"
                    (click)="askDelete(t.row)"
                  >
                    <i class="pi pi-trash" aria-hidden="true"></i>
                  </button>
                }
              </span>
            </li>
          }
        </ul>
      }
    </div>

    <app-crud-dialog [title]="dialogTitle()" [saving]="saving()" (save)="submit()" (closed)="saving.set(false)">
      <div [formGroup]="form" class="space-y-4">
        <app-form-field
          [label]="'settingsLocations.code' | transloco"
          inputId="loc-code"
          [control]="form.controls.code"
          [required]="true"
        >
          <input
            id="loc-code"
            dir="ltr"
            formControlName="code"
            class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm uppercase"
          />
        </app-form-field>
        <app-form-field
          [label]="'settingsLocations.name' | transloco"
          inputId="loc-name"
          [control]="form.controls.name"
          [required]="true"
        >
          <input
            id="loc-name"
            formControlName="name"
            class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm"
          />
        </app-form-field>
        <label class="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" formControlName="isActive" class="size-5" />
          {{ 'settingsLocations.active' | transloco }}
        </label>
      </div>
    </app-crud-dialog>
  `,
})
export class LocationsPage implements OnInit {
  protected readonly store = inject(LocationsStore);
  protected readonly auth = inject(AuthStore);
  private readonly warehousesApi = inject(WarehousesService);
  private readonly i18n = inject(TranslocoService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly printer = inject(PrintService);
  private readonly fb = inject(FormBuilder);

  private readonly dlg = viewChild.required(CrudDialogComponent);

  protected readonly warehouses = signal<Warehouse[]>([]);
  protected readonly warehouseId = signal<number | null>(null);
  protected readonly collapsed = signal<ReadonlySet<number>>(new Set<number>());
  protected readonly selected = signal<ReadonlySet<number>>(new Set<number>());
  protected readonly loadError = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly editingId = signal<number | null>(null);
  protected readonly formLevel = signal<LocationLevel>('zone');
  private readonly addParent = signal<WarehouseLocation | null>(null);

  protected readonly tree = computed(() => flattenTree(this.store.rows(), this.collapsed()));
  protected readonly bins = computed(() => this.store.rows().filter((r) => r.level === 'bin'));

  protected readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(20), Validators.pattern(/^[A-Za-z0-9-]+$/)]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    isActive: [true],
  });

  ngOnInit(): void {
    void this.loadWarehouses();
  }

  protected dialogTitle(): string {
    const key = this.editingId() === null ? 'settingsLocations.add' : 'settingsLocations.edit';
    return this.i18n.translate(key, { level: this.levelName(this.formLevel()) });
  }

  protected childName(row: WarehouseLocation): string {
    const next = nextLevel(row.level);
    return next ? this.levelName(next) : '';
  }

  private levelName(level: LocationLevel): string {
    return this.i18n.translate(`settingsLocations.levels.${level}`);
  }

  private async loadWarehouses(): Promise<void> {
    try {
      const res = await firstValueFrom(this.warehousesApi.list({ pageSize: 200 }));
      this.warehouses.set(res.data);
      if (res.data.length > 0) await this.pick(res.data[0].id);
    } catch {
      this.loadError.set(this.i18n.translate('errors.generic'));
    }
  }

  protected onWarehouse(e: Event): void {
    const v = (e.target as HTMLSelectElement).value;
    if (!v) {
      this.warehouseId.set(null);
      return;
    }
    void this.pick(Number(v));
  }

  private async pick(id: number): Promise<void> {
    this.warehouseId.set(id);
    this.collapsed.set(new Set<number>());
    this.selected.set(new Set<number>());
    this.actionError.set(null);
    await this.reload();
  }

  protected async reload(): Promise<void> {
    const id = this.warehouseId();
    if (id === null) return;
    this.loadError.set(null);
    try {
      await this.store.load({ page: 1, pageSize: 500, filters: { warehouseId: String(id) } });
    } catch {
      this.loadError.set(this.i18n.translate('errors.generic'));
    }
  }

  protected toggle(id: number): void {
    const next = new Set(this.collapsed());
    if (!next.delete(id)) next.add(id);
    this.collapsed.set(next);
  }

  protected toggleSelect(id: number, e: Event): void {
    const next = new Set(this.selected());
    if ((e.target as HTMLInputElement).checked) next.add(id);
    else next.delete(id);
    this.selected.set(next);
  }

  protected openAdd(parent: WarehouseLocation | null): void {
    const level = nextLevel(parent?.level ?? null);
    if (!level) return;
    this.actionError.set(null);
    this.addParent.set(parent);
    this.formLevel.set(level);
    this.editingId.set(null);
    this.form.reset({ code: '', name: '', isActive: true });
    this.dlg().open();
  }

  protected openEdit(row: WarehouseLocation): void {
    this.actionError.set(null);
    this.editingId.set(row.id);
    this.formLevel.set(row.level);
    this.form.reset({ code: row.code, name: row.name, isActive: row.isActive });
    this.dlg().open();
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const warehouseId = this.warehouseId();
    if (warehouseId === null) return;
    const v = this.form.getRawValue();
    const editing = this.editingId();
    const existing = editing === null ? null : this.store.rows().find((r) => r.id === editing);
    if (editing !== null && !existing) return;

    this.saving.set(true);
    const err = await this.store.save(editing, {
      warehouseId,
      parentId: existing ? existing.parentId : (this.addParent()?.id ?? null),
      level: existing ? existing.level : this.formLevel(),
      code: v.code.trim().toUpperCase(),
      name: v.name.trim(),
      isActive: v.isActive,
    });
    this.saving.set(false);
    if (err) {
      const target = /code/i.test(err) ? this.form.controls.code : this.form.controls.name;
      target.setErrors({ server: err });
      return;
    }
    const parent = this.addParent();
    if (editing === null && parent && this.collapsed().has(parent.id)) this.toggle(parent.id);
    this.dlg().close();
  }

  protected async askDelete(row: WarehouseLocation): Promise<void> {
    const yes = await this.confirm.confirm({
      title: this.i18n.translate('settingsLocations.deleteTitle'),
      message: this.i18n.translate('settingsLocations.deleteMessage'),
      confirmLabel: this.i18n.translate('common.delete'),
      cancelLabel: this.i18n.translate('common.cancel'),
      danger: true,
    });
    if (!yes) return;
    this.actionError.set(await this.store.remove(row.id));
  }

  /** Bins ke labels: diye gaye, warna chune hue, warna warehouse ke sab bins. */
  protected async printLabels(only?: WarehouseLocation[]): Promise<void> {
    const pool = only ?? (this.selected().size > 0 ? this.bins().filter((b) => this.selected().has(b.id)) : this.bins());
    const printable = pool.filter((b) => b.barcode);
    if (printable.length === 0) {
      this.actionError.set(this.i18n.translate('settingsLocations.noBins'));
      return;
    }
    this.actionError.set(null);
    try {
      const rows = this.store.rows();
      const labels: BinLabel[] = await Promise.all(
        printable.map(async (bin) => ({
          title: bin.code,
          caption: pathOf(rows, bin).map((p) => p.name).join(' / '),
          svg: await code128Svg(bin.barcode ?? ''),
        })),
      );
      await this.printer.print({
        title: this.i18n.translate('settingsLocations.printTitle'),
        body: buildBinLabelSheet(labels),
        paper: 'a4',
        dir: 'ltr',
      });
    } catch {
      this.actionError.set(this.i18n.translate('settingsLocations.labelPrintFailed'));
    }
  }
}