import { ChangeDetectionStrategy, Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthStore } from '../../../core/auth/auth.store';
import { ConfirmDialogService } from '../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { CrudDialogComponent } from '../../../shared/ui/crud-dialog/crud-dialog.component';
import { RowAction, RowActionEvent, TableColumn, TableQuery } from '../../../shared/ui/data-table/data-table.models';
import { FormFieldComponent } from '../../../shared/ui/form-field/form-field.component';
import { ListPageComponent } from '../../../shared/ui/list-page/list-page.component';
import { Category } from '../models';
import { CategoriesStore } from '../stores/products.stores';

@Component({
  selector: 'app-categories-page',
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    ListPageComponent,
    CrudDialogComponent,
    FormFieldComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-list-page
      [title]="'categories.title' | transloco"
      [addLabel]="'categories.add' | transloco"
      addPermission="products.category.create"
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
      [title]="(editingId() === null ? 'categories.add' : 'categories.edit') | transloco"
      [saving]="saving()"
      (save)="submit()"
      (closed)="saving.set(false)"
    >
      <div [formGroup]="form" class="space-y-4">
        <app-form-field
          [label]="'categories.name' | transloco"
          inputId="category-name"
          [control]="form.controls.name"
          [required]="true"
        >
          <input
            id="category-name"
            formControlName="name"
            class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm"
          />
        </app-form-field>

        <label class="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" formControlName="isActive" class="size-5" />
          {{ 'categories.active' | transloco }}
        </label>
      </div>
    </app-crud-dialog>
  `,
})
export class CategoriesPage implements OnInit {
  protected readonly store = inject(CategoriesStore);
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
    name: ['', [Validators.required, Validators.maxLength(100)]],
    isActive: [true],
  });

  protected readonly columns: TableColumn<Category>[] = [
    { key: 'name', header: this.i18n.translate('categories.name'), sortable: true },
    {
      key: 'isActive',
      header: this.i18n.translate('categories.active'),
      cell: (r) =>
        this.i18n.translate(r.isActive ? 'common.status.active' : 'common.status.inactive'),
    },
  ];

  protected readonly actions: RowAction<Category>[] = [
    {
      id: 'edit',
      label: this.i18n.translate('common.edit'),
      icon: 'pi pi-pencil',
      visible: () => this.auth.can('products.category.edit'),
    },
    {
      id: 'delete',
      label: this.i18n.translate('common.delete'),
      icon: 'pi pi-trash',
      danger: true,
      visible: () => this.auth.can('products.category.delete'),
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

  protected onAction(e: RowActionEvent<Category>): void {
    if (e.actionId === 'edit') this.openForm(e.row);
    if (e.actionId === 'delete') void this.askDelete(e.row);
  }

  protected openForm(row: Category | null): void {
    this.actionError.set(null);
    this.editingId.set(row?.id ?? null);
    this.form.reset({ name: row?.name ?? '', isActive: row?.isActive ?? true });
    this.dlg().open();
  }

  protected closeForm(): void {
    this.dlg().close();
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    const err = await this.store.save(this.editingId(), { name: v.name.trim(), isActive: v.isActive });
    this.saving.set(false);
    if (err) {
      this.form.controls.name.setErrors({ server: err });
      return;
    }
    this.closeForm();
  }

  private async askDelete(row: Category): Promise<void> {
    const yes = await this.confirm.confirm({
      title: this.i18n.translate('categories.deleteTitle'),
      message: this.i18n.translate('categories.deleteMessage'),
      confirmLabel: this.i18n.translate('common.delete'),
      cancelLabel: this.i18n.translate('common.cancel'),
      danger: true,
    });
    if (!yes) return;
    const err = await this.store.remove(row.id);
    this.actionError.set(err);
  }
}