import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { HasPermissionDirective } from '../../../core/auth/has-permission.directive';
import { ConfirmDialogService } from '../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { DataTableComponent } from '../../../shared/ui/data-table/data-table.component';
import { RowAction, RowActionEvent, TableColumn, TableQuery } from '../../../shared/ui/data-table/data-table.models';
import { PageToolbarComponent } from '../../../shared/ui/page-toolbar/page-toolbar.component';
import { Brand, Category, Product } from '../models';
import { BrandsService, CategoriesService } from '../services/products.service';
import { ProductsStore } from '../stores/products.stores';
import { categoryPaths } from '../utils/category-path';
import { specSummary } from '../utils/product-utils';

@Component({
  selector: 'app-products-page',
  imports: [TranslocoPipe, HasPermissionDirective, DataTableComponent, PageToolbarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-toolbar [title]="'products.title' | transloco">
      <button
        *hasPermission="'products.product.create'"
        type="button"
        class="min-h-12 rounded-lg bg-[#2563EB] px-5 font-medium text-white"
        (click)="add()"
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
  `,
})
export class ProductsPage implements OnInit {
  protected readonly store = inject(ProductsStore);
  private readonly brandsApi = inject(BrandsService);
  private readonly categoriesApi = inject(CategoriesService);
  private readonly auth = inject(AuthStore);
  private readonly i18n = inject(TranslocoService);
  private readonly confirm = inject(ConfirmDialogService);
  private readonly router = inject(Router);

  protected readonly loadError = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);

  protected readonly brands = signal<Brand[]>([]);
  protected readonly categories = signal<Category[]>([]);
  private readonly brandNames = computed(
    () => new Map<number, string>(this.brands().map((b) => [b.id, b.name] as [number, string])),
  );
  private readonly categoryNames = computed(() => categoryPaths(this.categories()));

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
    {
      key: 'specs',
      header: this.i18n.translate('products.specs'),
      cell: (r) => specSummary(r.specs) || '-',
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
      // Brand/category columns '-' dikhayenge, table phir bhi chalegi (error toast interceptor dikhata hai)
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

  protected add(): void {
    void this.router.navigate(['/products/list/new']);
  }

  protected onAction(e: RowActionEvent<Product>): void {
    if (e.actionId === 'edit') void this.router.navigate(['/products/list', e.row.id, 'edit']);
    if (e.actionId === 'delete') void this.askDelete(e.row);
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