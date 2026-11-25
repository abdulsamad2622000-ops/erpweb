import { ChangeDetectionStrategy, Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthStore } from '../../../core/auth/auth.store';
import { ConfirmDialogService } from '../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { CrudDialogComponent } from '../../../shared/ui/crud-dialog/crud-dialog.component';
import { RowAction, RowActionEvent, TableColumn, TableQuery } from '../../../shared/ui/data-table/data-table.models';
import { FormFieldComponent } from '../../../shared/ui/form-field/form-field.component';
import { ListPageComponent } from '../../../shared/ui/list-page/list-page.component';
import { Branch } from '../models/org.models';
import { BranchesStore } from '../stores/org.stores';

@Component({
  selector: 'app-branches-page',
  imports: [ReactiveFormsModule, TranslocoPipe, ListPageComponent, CrudDialogComponent, FormFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-list-page
      [title]="'settingsBranches.title' | transloco"
      [addLabel]="'settingsBranches.add' | transloco"
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
      [title]="(editingId() === null ? 'settingsBranches.add' : 'settingsBranches.edit') | transloco"
      [saving]="saving()"
      (save)="submit()"
      (closed)="saving.set(false)"
    >
      <div [formGroup]="form" class="space-y-4">
        <app-form-field
          [label]="'settingsBranches.code' | transloco"
          inputId="branch-code"
          [control]="form.controls.code"
          [required]="true"
        >
          <input placeholder="Enter branch code..."
            id="branch-code"
            dir="ltr"
            formControlName="code"
            class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm uppercase"
          />
        </app-form-field>
        <app-form-field
          [label]="'settingsBranches.name' | transloco"
          inputId="branch-name"
          [control]="form.controls.name"
          [required]="true"
        >
          <input placeholder="Enter branch name..."
            id="branch-name"
            formControlName="name"
            class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm"
          />
        </app-form-field>
        <app-form-field
          [label]="'settingsBranches.city' | transloco"
          inputId="branch-city"
          [control]="form.controls.city"
        >
          <input placeholder="Enter branch city..."
            id="branch-city"
            formControlName="city"
            class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm"
          />
        </app-form-field>
        <app-form-field
          [label]="'settingsBranches.address' | transloco"
          inputId="branch-address"
          [control]="form.controls.address"
        >
          <textarea placeholder="Enter branch address..."
            id="branch-address"
            rows="3"
            formControlName="address"
            class="min-h-24 w-full rounded-lg border border-slate-400 bg-transparent px-3 py-2 text-sm"
          ></textarea>
        </app-form-field>
        <app-form-field
          [label]="'settingsBranches.phone' | transloco"
          inputId="branch-phone"
          [control]="form.controls.phone"
        >
          <input placeholder="Enter branch phone..."
            id="branch-phone"
            type="tel"
            dir="ltr"
            formControlName="phone"
            class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm"
          />
        </app-form-field>
        <label class="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" formControlName="isActive" class="size-5" />
          {{ 'settingsBranches.active' | transloco }}
        </label>
      </div>
    </app-crud-dialog>
  `,
})
export class BranchesPage implements OnInit {
  protected readonly store = inject(BranchesStore);
  private readonly auth = inject(AuthStore);
  private readonly i18n = inject(TranslocoService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly fb = inject(FormBuilder);

  private readonly dlg = viewChild.required(CrudDialogComponent);

  protected readonly loadError = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly editingId = signal<number | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    code: ['', [Validators.required, Validators.maxLength(10), Validators.pattern(/^[A-Za-z0-9-]+$/)]],
    name: ['', [Validators.required, Validators.maxLength(100)]],
    city: ['', [Validators.maxLength(80)]],
    address: ['', [Validators.maxLength(300)]],
    phone: ['', [Validators.maxLength(40)]],
    isActive: [true],
  });

  protected readonly columns: TableColumn<Branch>[] = [
    { key: 'code', header: this.i18n.translate('settingsBranches.code'), sortable: true },
    { key: 'name', header: this.i18n.translate('settingsBranches.name'), sortable: true },
    { key: 'city', header: this.i18n.translate('settingsBranches.city'), sortable: true },
    { key: 'phone', header: this.i18n.translate('settingsBranches.phone') },
    {
      key: 'isActive',
      header: this.i18n.translate('settingsBranches.active'),
      cell: (r) => this.i18n.translate(r.isActive ? 'common.status.active' : 'common.status.inactive'),
    },
  ];

  protected readonly actions: RowAction<Branch>[] = [
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
    void this.reload();
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

  protected onAction(e: RowActionEvent<Branch>): void {
    if (e.actionId === 'edit') this.openForm(e.row);
    if (e.actionId === 'delete') void this.askDelete(e.row);
  }

  protected openForm(row: Branch | null): void {
    this.actionError.set(null);
    this.editingId.set(row?.id ?? null);
    this.form.reset({
      code: row?.code ?? '',
      name: row?.name ?? '',
      city: row?.city ?? '',
      address: row?.address ?? '',
      phone: row?.phone ?? '',
      isActive: row?.isActive ?? true,
    });
    this.dlg().open();
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    const err = await this.store.save(this.editingId(), {
      code: v.code.trim().toUpperCase(),
      name: v.name.trim(),
      city: v.city.trim(),
      address: v.address.trim(),
      phone: v.phone.trim(),
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

  private async askDelete(row: Branch): Promise<void> {
    const yes = await this.confirm.confirm({
      title: this.i18n.translate('settingsBranches.deleteTitle'),
      message: this.i18n.translate('settingsBranches.deleteMessage'),
      confirmLabel: this.i18n.translate('common.delete'),
      cancelLabel: this.i18n.translate('common.cancel'),
      danger: true,
    });
    if (!yes) return;
    const err = await this.store.remove(row.id);
    this.actionError.set(err);
  }
}