import { ChangeDetectionStrategy, Component, ElementRef, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { HasPermissionDirective } from '../../../core/auth/has-permission.directive';
import { ConfirmDialogService } from '../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { DataTableComponent } from '../../../shared/ui/data-table/data-table.component';
import { RowAction, RowActionEvent, TableColumn, TableQuery } from '../../../shared/ui/data-table/data-table.models';
import { FormFieldComponent } from '../../../shared/ui/form-field/form-field.component';
import { PageToolbarComponent } from '../../../shared/ui/page-toolbar/page-toolbar.component';
import { Brand, Category, Product, ProductInput } from '../models';
import { BrandsService, CategoriesService } from '../services/products.service';
import { ProductsStore } from '../stores/products.stores';

@Component({
  selector: 'app-products-page',
  imports: [
    ReactiveFormsModule,
    TranslocoPipe,
    HasPermissionDirective,
    DataTableComponent,
    PageToolbarComponent,
    FormFieldComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-toolbar [title]="'products.title' | transloco">
      <button
        *hasPermission="'products.product.create'"
        type="button"
        class="min-h-12 rounded-lg bg-[#2563EB] px-5 font-medium text-white"
        (click)="openForm(null)"
      >
        {{ 'products.add' | transloco }}
      </button>
    </app-page-toolbar>

    @if (actionError(); as msg) {
      <p role="alert" class="mb-3 rounded-lg border border-red-600 p-3 text-sm text-red-600">{{ msg }}</p>
    }

    <app-data-table
      [rows]="store.rows()"
      [columns]="columns"
      [total]="store.total()"
      [query]="store.query()"
      [loading]="store.loading()"
      [error]="loadError()"
      [actions]="actions"
      (queryChange)="onQuery($event)"
      (action)="onAction($event)"
      (retry)="reload()"
    />

    <dialog
      #dlg
      class="m-auto rounded-xl border border-slate-300 bg-white p-0 text-slate-900 backdrop:bg-black/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      (close)="saving.set(false)"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" class="max-h-[88vh] w-[min(92vw,30rem)] space-y-4 overflow-y-auto p-5">
        <h2 class="text-lg font-semibold">
          {{ (editingId() === null ? 'products.add' : 'products.edit') | transloco }}
        </h2>

        <app-form-field [label]="'products.sku' | transloco" inputId="product-sku" [control]="form.controls.sku" [required]="true">
          <input
            id="product-sku"
            formControlName="sku"
            class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm"
          />
        </app-form-field>

        <app-form-field [label]="'products.name' | transloco" inputId="product-name" [control]="form.controls.name" [required]="true">
          <input
            id="product-name"
            formControlName="name"
            class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm"
          />
        </app-form-field>

        <app-form-field [label]="'products.barcode' | transloco" inputId="product-barcode" [control]="form.controls.barcode">
          <input
            id="product-barcode"
            formControlName="barcode"
            class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm"
          />
        </app-form-field>

        <app-form-field [label]="'products.brand' | transloco" inputId="product-brand" [control]="form.controls.brandId" [required]="true">
          <select
            id="product-brand"
            formControlName="brandId"
            class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm"
          >
            <option [ngValue]="null">{{ 'products.none' | transloco }}</option>
            @for (b of brands(); track b.id) {
              <option [ngValue]="b.id">{{ b.name }}</option>
            }
          </select>
        </app-form-field>

        <app-form-field [label]="'products.category' | transloco" inputId="product-category" [control]="form.controls.categoryId" [required]="true">
          <select
            id="product-category"
            formControlName="categoryId"
            class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm"
          >
            <option [ngValue]="null">{{ 'products.none' | transloco }}</option>
            @for (c of categories(); track c.id) {
              <option [ngValue]="c.id">{{ c.name }}</option>
            }
          </select>
        </app-form-field>

        <app-form-field [label]="'products.tracking' | transloco" inputId="product-tracking" [control]="form.controls.tracking">
          <select
            id="product-tracking"
            formControlName="tracking"
            class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm"
          >
            <option value="serialized">{{ 'products.serialized' | transloco }}</option>
            <option value="batch">{{ 'products.batch' | transloco }}</option>
          </select>
        </app-form-field>

        <label class="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" formControlName="isActive" class="size-5" />
          {{ 'products.active' | transloco }}
        </label>

        <div class="flex justify-end gap-2">
          <button type="button" class="min-h-12 rounded-lg border border-slate-400 px-5" (click)="closeForm()">
            {{ 'common.cancel' | transloco }}
          </button>
          <button
            type="submit"
            class="min-h-12 rounded-lg bg-[#2563EB] px-5 font-medium text-white disabled:opacity-50"
            [disabled]="saving()"
          >
            {{ 'common.save' | transloco }}
          </button>
        </div>
      </form>
    </dialog>
  `,
})
export class ProductsPage implements OnInit {
  protected readonly store = inject(ProductsStore);
  private readonly brandsApi = inject(BrandsService);
  private readonly categoriesApi = inject(CategoriesService);
  private readonly auth = inject(AuthStore);
  private readonly i18n = inject(TranslocoService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly fb = inject(FormBuilder);

  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  protected readonly loadError = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly editingId = signal<number | null>(null);

  protected readonly brands = signal<Brand[]>([]);
  protected readonly categories = signal<Category[]>([]);
  private readonly brandNames = computed(
    () => new Map<number, string>(this.brands().map((b) => [b.id, b.name] as [number, string])),
  );
  private readonly categoryNames = computed(
    () => new Map<number, string>(this.categories().map((c) => [c.id, c.name] as [number, string])),
  );

  protected readonly form = this.fb.nonNullable.group({
    sku: ['', [Validators.required, Validators.maxLength(50)]],
    name: ['', [Validators.required, Validators.maxLength(150)]],
    barcode: ['', [Validators.maxLength(64)]],
    brandId: this.fb.control<number | null>(null, Validators.required),
    categoryId: this.fb.control<number | null>(null, Validators.required),
    tracking: ['serialized' as 'serialized' | 'batch'],
    isActive: [true],
  });

  protected readonly columns: TableColumn<Product>[] = [
    { key: 'sku', header: this.i18n.translate('products.sku'), sortable: true },
    { key: 'name', header: this.i18n.translate('products.name'), sortable: true },
    {
      key: 'brandId',
      header: this.i18n.translate('products.brand'),
      cell: (r) => this.brandNames().get(r.brandId ?? -1) ?? '-',
    },
    {
      key: 'categoryId',
      header: this.i18n.translate('products.category'),
      cell: (r) => this.categoryNames().get(r.categoryId ?? -1) ?? '-',
    },
    { key: 'barcode', header: this.i18n.translate('products.barcode'), cell: (r) => r.barcode ?? '-' },
    {
      key: 'trackBatch',
      header: this.i18n.translate('products.tracking'),
      cell: (r) => this.i18n.translate(r.trackBatch ? 'products.batch' : 'products.serialized'),
    },
    {
      key: 'isActive',
      header: this.i18n.translate('products.active'),
      cell: (r) => this.i18n.translate(r.isActive ? 'common.status.active' : 'common.status.inactive'),
    },
  ];

  protected readonly actions: RowAction<Product>[] = [
    {
      id: 'edit',
      label: this.i18n.translate('common.edit'),
      icon: 'pi pi-pencil',
      visible: () => this.auth.can('products.product.edit'),
    },
    {
      id: 'delete',
      label: this.i18n.translate('common.delete'),
      icon: 'pi pi-trash',
      danger: true,
      visible: () => this.auth.can('products.product.delete'),
    },
  ];

  ngOnInit(): void {
    void this.loadLookups();
    void this.reload();
  }

  private async loadLookups(): Promise<void> {
    try {
      const [b, c] = await Promise.all([
        firstValueFrom(this.brandsApi.list({ pageSize: 200 })),
        firstValueFrom(this.categoriesApi.list({ pageSize: 200 })),
      ]);
      this.brands.set(b.data);
      this.categories.set(c.data);
    } catch {
      // dropdown khali rahenge, table phir bhi chalegi (error toast interceptor dikhata hai)
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

  protected onAction(e: RowActionEvent<Product>): void {
    if (e.actionId === 'edit') this.openForm(e.row);
    if (e.actionId === 'delete') void this.askDelete(e.row);
  }

  protected openForm(row: Product | null): void {
    this.actionError.set(null);
    this.editingId.set(row?.id ?? null);
    this.form.reset({
      sku: row?.sku ?? '',
      name: row?.name ?? '',
      barcode: row?.barcode ?? '',
      brandId: row?.brandId ?? null,
      categoryId: row?.categoryId ?? null,
      tracking: row?.trackBatch ? 'batch' : 'serialized',
      isActive: row?.isActive ?? true,
    });
    this.dlg().nativeElement.showModal();
  }

  protected closeForm(): void {
    this.dlg().nativeElement.close();
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    const body: ProductInput = {
      sku: v.sku.trim(),
      name: v.name.trim(),
      barcode: v.barcode.trim() || null,
      brandId: v.brandId,
      categoryId: v.categoryId,
      trackBatch: v.tracking === 'batch',
      isActive: v.isActive,
    };
    const err = await this.store.save(this.editingId(), body);
    this.saving.set(false);
    if (err) {
      const target = /sku/i.test(err) ? this.form.controls.sku : this.form.controls.name;
      target.setErrors({ server: err });
      return;
    }
    this.closeForm();
  }

  private async askDelete(row: Product): Promise<void> {
    const yes = await this.confirm.confirm({
      title: this.i18n.translate('products.deleteTitle'),
      message: this.i18n.translate('products.deleteMessage'),
      confirmLabel: this.i18n.translate('common.delete'),
      cancelLabel: this.i18n.translate('common.cancel'),
      danger: true,
    });
    if (!yes) return;
    const err = await this.store.remove(row.id);
    this.actionError.set(err);
  }
}