import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { ImportValue } from '../../../shared/ui/import-wizard/import-utils';
import { ImportWizardComponent } from '../../../shared/ui/import-wizard/import-wizard.component';
import { BrandsService, CategoriesService, ProductsService } from '../services/products.service';
import { PRODUCT_IMPORT_FIELDS, buildImportProduct } from '../utils/import-utils';

interface Failure {
  sku: string;
  error: string;
}

@Component({
  selector: 'app-product-import-page',
  imports: [ImportWizardComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-5xl space-y-4">
      <div class="flex flex-wrap items-center gap-3">
        <button type="button" class="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-400 px-4 text-sm" (click)="back()">
          <i class="pi pi-arrow-left" aria-hidden="true"></i>
          {{ 'productImport.back' | transloco }}
        </button>
        <h1 class="text-xl font-semibold">{{ 'productImport.title' | transloco }}</h1>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900">
        @if (saving()) {
          <p role="status" class="text-sm">
            {{ 'productImport.saving' | transloco }} {{ progress() }} / {{ total() }}
          </p>
        } @else if (done()) {
          <div class="space-y-4" aria-live="polite">
            <p class="text-sm">
              <span class="text-[#16A34A]">{{ created() }} {{ 'productImport.created' | transloco }}</span>
              @if (failures().length > 0) {
                <span class="ms-4 text-[#DC2626]">{{ failures().length }} {{ 'productImport.failed' | transloco }}</span>
              }
            </p>
            @if (failures().length > 0) {
              <ul class="space-y-1 rounded-lg border border-red-600 p-3 text-sm text-red-600">
                @for (f of failures(); track $index) {
                  <li>{{ f.sku }}: {{ f.error }}</li>
                }
              </ul>
            }
            <div class="flex flex-wrap gap-2">
              <button type="button" class="min-h-12 rounded-lg bg-[#2563EB] px-5 font-medium text-white" (click)="back()">
                {{ 'productImport.viewList' | transloco }}
              </button>
              <button type="button" class="min-h-12 rounded-lg border border-slate-400 px-5" (click)="again()">
                {{ 'productImport.importMore' | transloco }}
              </button>
            </div>
          </div>
        } @else {
          @if (loadError()) {
            <p role="alert" class="mb-3 rounded-lg border border-red-600 p-3 text-sm text-red-600">
              {{ 'productImport.lookupFailed' | transloco }}
            </p>
          }
          <app-import-wizard [fields]="fields" (imported)="run($event)" (cancelled)="back()" />
        }
      </div>
    </section>
  `,
})
export class ProductImportPage {
  private readonly router = inject(Router);
  private readonly api = inject(ProductsService);
  private readonly brandsApi = inject(BrandsService);
  private readonly categoriesApi = inject(CategoriesService);

  protected readonly fields = PRODUCT_IMPORT_FIELDS;
  protected readonly saving = signal(false);
  protected readonly done = signal(false);
  protected readonly loadError = signal(false);
  protected readonly progress = signal(0);
  protected readonly total = signal(0);
  protected readonly created = signal(0);
  protected readonly failures = signal<Failure[]>([]);

  protected async run(rows: Record<string, ImportValue>[]): Promise<void> {
    this.loadError.set(false);
    let brands, categories;
    try {
      const [b, c] = await Promise.all([
        firstValueFrom(this.brandsApi.list({ pageSize: 500 })),
        firstValueFrom(this.categoriesApi.list({ pageSize: 500 })),
      ]);
      brands = b.data;
      categories = c.data;
    } catch {
      this.loadError.set(true);
      return;
    }

    this.saving.set(true);
    this.total.set(rows.length);
    this.progress.set(0);
    let ok = 0;
    const failed: Failure[] = [];
    for (const row of rows) {
      const sku = String(row['sku'] ?? '');
      const built = buildImportProduct(row, brands, categories);
      if (!built.ok) {
        failed.push({ sku, error: built.error });
      } else {
        try {
          await firstValueFrom(this.api.create(built.body));
          ok++;
        } catch (e) {
          const msg = (e as { error?: { message?: string } })?.error?.message;
          failed.push({ sku, error: msg ?? 'Could not be saved' });
        }
      }
      this.progress.update((n) => n + 1);
    }
    this.created.set(ok);
    this.failures.set(failed);
    this.saving.set(false);
    this.done.set(true);
  }

  protected again(): void {
    this.done.set(false);
    this.failures.set([]);
    this.created.set(0);
  }

  protected back(): void {
    void this.router.navigate(['/products/list']);
  }
}