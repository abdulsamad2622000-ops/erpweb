import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { ConfirmDialogService } from '../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { CrudDialogComponent } from '../../../shared/ui/crud-dialog/crud-dialog.component';
import { RowAction, RowActionEvent, TableColumn, TableQuery } from '../../../shared/ui/data-table/data-table.models';
import { FormFieldComponent } from '../../../shared/ui/form-field/form-field.component';
import { ListPageComponent } from '../../../shared/ui/list-page/list-page.component';
import { Branch, WAREHOUSE_TYPES, Warehouse, WarehouseType } from '../models/org.models';
import { BranchesService } from '../services/org.service';
import { WarehousesStore } from '../stores/org.stores';

@Component({
  selector: 'app-warehouses-page',
  imports: [ReactiveFormsModule, TranslocoPipe, ListPageComponent, CrudDialogComponent, FormFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-list-page
      [title]="'settingsWarehouses.title' | transloco"
      [addLabel]="'settingsWarehouses.add' | transloco"
      addPermission="settings.manage"
      [rows]="store.rows()"
      [columns]="columns"
      [total]="store.total()"
      [query]="store.query()"
      [loading]="store.loading()"
      [loadError]="loadError()"
      [actionError]="actionError()"
      [actions]="actions"
      (add)="openForm(null)"
      (queryChange)="onQuery($event)"
      (action)="onAction($event)"
      (retry)="reload()"
    />

    <app-crud-dialog
      [title]="(editingId() === null ? 'settingsWarehouses.add' : 'settingsWarehouses.edit') | transloco"
      [saving]="saving()"
      (save)="submit()"
      (closed)="saving.set(false)"
    >
      <div [formGroup]="form" class="space-y-4">
        <app-form-field
          [label]="'settingsWarehouses.branch' | transloco"
          inputId="warehouse-branch"
          [control]="form.controls.branchId"
          [required]="true"
        >
          <select
            id="warehouse-branch"
            formControlName="branchId"
            class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm"
          >
            <option [ngValue]="null">{{ 'settingsWarehouses.chooseBranch' | transloco }}</option>
            @for (b of branches(); track b.id) {
              <option [ngValue]="b.id">{{ b.name }}</option>
            }
          </select>
        </app-form-field>
        <app-form-field
          [label]="'settingsWarehouses.code' | transloco"
          inputId="warehouse-code"
          [control]="form.controls.code"
          [required]="true"
        >
          <input
            id="warehouse-code"
            dir="ltr"
            formControlName="code"
            class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm uppercase"
          />
        </app-form-field>
        <app-form-field
          [label]="'settingsWarehouses.name' | transloco"
          inputId="warehouse-name"
          [control]="form.controls.name"
          [required]="true"
        >
          <input
            id="warehouse-name"
            formControlName="name"
            class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm"
          />
        </app-form-field>
        <app-form-field
          [label]="'settingsWarehouses.type' | transloco"
          inputId="warehouse-type"
          [control]="form.controls.type"
          [required]="true"
        >
          <select
            id="warehouse-type"
            formControlName="type"
            class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm"
          >
            @for (t of types; track t) {
              <option [value]="t">{{ 'settingsWarehouses.types.' + t | transloco }}</option>
            }
          </select>
        </app-form-field>
        <label class="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" formControlName="isActive" class="size-5" />
          {{ 'settingsWarehouses.active' | transloco }}
        </label>
      </div>
    </app-crud-dialog>
  `,
})
export class WarehousesPage implements OnInit {
  protected readonly store = inject(WarehousesStore);
  private readonly branchesApi = inject(BranchesService);
  private readonly auth = inject(AuthStore);
  private readonly i18n = inject(TranslocoService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly fb = inject(FormBuilder);

  private readonly dlg = viewChild.required(CrudDialogComponent);

  protected readonly types = WAREHOUSE_TYPES;
  protected readonly branches = signal<Branch[]>([]);
  private readonly branchNames = computed(
    () => new Map<number, string>(this.branches().map((b) => [b.id, b.name] as [number, string])),
  );

  protected readonly loadError = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly editingId = signal<number | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    branchId: this.fb.control<number | null>(null, Validators.required),
    code: ['', [Validators.required, Validators.maxLength(20), Validators.pattern(/^[A-Za-z0-9-]+$/)]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    type: ['sellable' as WarehouseType, [Validators.required]],
    isActive: [true],
  });

  protected readonly columns: TableColumn<Warehouse>[] = [
    { key: 'code', header: this.i18n.translate('settingsWarehouses.code'), sortable: true },
    { key: 'name', header: this.i18n.translate('settingsWarehouses.name'), sortable: true },
    {
      key: 'branchId',
      header: this.i18n.translate('settingsWarehouses.branch'),
      cell: (r) => this.branchNames().get(r.branchId) ?? '-',
    },
    {
      key: 'type',
      header: this.i18n.translate('settingsWarehouses.type'),
      cell: (r) => this.i18n.translate(`settingsWarehouses.types.${r.type}`),
    },
    {
      key: 'isActive',
      header: this.i18n.translate('settingsWarehouses.active'),
      cell: (r) => this.i18n.translate(r.isActive ? 'common.status.active' : 'common.status.inactive'),
    },
  ];

  protected readonly actions: RowAction<Warehouse>[] = [
    {
      id: 'edit',
      label: this.i18n.translate('common.edit'),
      icon: 'pi pi-pencil',
      visible: () => this.auth.can('settings.manage'),
    },
    {
      id: 'delete',
      label: this.i18n.translate('common.delete'),
      icon: 'pi pi-trash',
      danger: true,
      visible: () => this.auth.can('settings.manage'),
    },
  ];

  ngOnInit(): void {
    void this.loadBranches();
    void this.reload();
  }

  private async loadBranches(): Promise<void> {
    try {
      const res = await firstValueFrom(this.branchesApi.list({ pageSize: 200 }));
      this.branches.set(res.data);
    } catch {
      // dropdown khali rahega, table phir bhi chalegi
    }
  }

  protected async reload(): Promise<void> {
    await this.run(() => this.store.load());
  }

  protected async onQuery(q: TableQuery): Promise<void> {
    await this.run(() => this.store.load(q));
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    this.loadError.set(null);
    try {
      await fn();
    } catch {
      this.loadError.set(this.i18n.translate('errors.generic'));
    }
  }

  protected onAction(e: RowActionEvent<Warehouse>): void {
    if (e.actionId === 'edit') this.openForm(e.row);
    if (e.actionId === 'delete') void this.askDelete(e.row);
  }

  protected openForm(row: Warehouse | null): void {
    this.actionError.set(null);
    this.editingId.set(row?.id ?? null);
    this.form.reset({
      branchId: row?.branchId ?? null,
      code: row?.code ?? '',
      name: row?.name ?? '',
      type: row?.type ?? 'sellable',
      isActive: row?.isActive ?? true,
    });
    this.dlg().open();
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    if (v.branchId === null) return;
    this.saving.set(true);
    const err = await this.store.save(this.editingId(), {
      branchId: v.branchId,
      code: v.code.trim().toUpperCase(),
      name: v.name.trim(),
      type: v.type,
      isActive: v.isActive,
    });
    this.saving.set(false);
    if (err) {
      const target = /code/i.test(err) ? this.form.controls.code : this.form.controls.name;
      target.setErrors({ server: err });
      return;
    }
    this.dlg().close();
  }

  private async askDelete(row: Warehouse): Promise<void> {
    const yes = await this.confirm.confirm({
      title: this.i18n.translate('settingsWarehouses.deleteTitle'),
      message: this.i18n.translate('settingsWarehouses.deleteMessage'),
      confirmLabel: this.i18n.translate('common.delete'),
      cancelLabel: this.i18n.translate('common.cancel'),
      danger: true,
    });
    if (!yes) return;
    const err = await this.store.remove(row.id);
    this.actionError.set(err);
  }
}