import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { FormFieldComponent } from '../../../shared/ui/form-field/form-field.component';
import { Brand, Category, ProductInput } from '../models';
import { BrandsService, CategoriesService, ProductsService } from '../services/products.service';
import { ProductsStore } from '../stores/products.stores';
import { flattenCategories } from '../utils/category-tree';

type TabId = 'basics' | 'specs';
const TABS: readonly TabId[] = ['basics', 'specs'];

const CPU_SUGGESTIONS = ['Intel Core i3', 'Intel Core i5', 'Intel Core i7', 'Intel Core i9', 'AMD Ryzen 5', 'AMD Ryzen 7'];
const RAM_SUGGESTIONS = ['4 GB', '8 GB', '16 GB', '32 GB', '64 GB'];
const STORAGE_SUGGESTIONS = ['256 GB SSD', '512 GB SSD', '1 TB SSD', '1 TB HDD', '2 TB HDD'];
const GPU_SUGGESTIONS = ['Integrated', 'NVIDIA GeForce RTX 3050', 'NVIDIA GeForce RTX 4060', 'AMD Radeon'];
const SCREEN_SUGGESTIONS = ['13.3"', '14"', '15.6"', '17.3"', '24"'];

const INPUT = 'min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm';

@Component({
  selector: 'app-product-form-page',
  imports: [ReactiveFormsModule, TranslocoPipe, FormFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-3xl space-y-4">
      <div class="flex flex-wrap items-center gap-3">
        <button
          type="button"
          class="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-400 px-4 text-sm"
          (click)="back()"
        >
          <i class="pi pi-arrow-left" aria-hidden="true"></i>
          {{ 'productForm.back' | transloco }}
        </button>
        <h1 class="text-xl font-semibold">
          {{ (isEdit ? 'productForm.editTitle' : 'productForm.addTitle') | transloco }}
        </h1>
      </div>

      @if (loadError(); as msg) {
        <div role="alert" class="space-y-3 rounded-xl border border-red-600 p-4 text-sm text-red-600">
          <p>{{ msg }}</p>
          <button type="button" class="min-h-12 rounded-lg border border-red-600 px-5" (click)="loadProduct()">
            {{ 'productForm.retry' | transloco }}
          </button>
        </div>
      } @else if (loading()) {
        <div role="status" class="animate-pulse space-y-3">
          <span class="sr-only">{{ 'productForm.loading' | transloco }}</span>
          <div class="h-12 rounded-lg bg-slate-200 dark:bg-slate-700"></div>
          <div class="h-12 rounded-lg bg-slate-200 dark:bg-slate-700"></div>
          <div class="h-24 rounded-lg bg-slate-200 dark:bg-slate-700"></div>
        </div>
      } @else {
        <form
          [formGroup]="form"
          (ngSubmit)="submit()"
          class="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
        >
          <div
            role="tablist"
            [attr.aria-label]="'productForm.tabsLabel' | transloco"
            class="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-700"
          >
            @for (t of tabs; track t) {
              <button
                type="button"
                role="tab"
                [id]="'tab-' + t"
                [attr.aria-selected]="tab() === t"
                [attr.aria-controls]="'panel-' + t"
                [attr.tabindex]="tab() === t ? 0 : -1"
                class="min-h-12 whitespace-nowrap border-b-2 px-4 text-sm font-medium"
                [class.border-[#2563EB]]="tab() === t"
                [class.text-[#2563EB]]="tab() === t"
                [class.border-transparent]="tab() !== t"
                (click)="selectTab(t)"
                (keydown)="onTabKey($event)"
              >
                {{ 'productForm.tabs.' + t | transloco }}
                @if (tabErrors()[t]) {
                  <span class="ms-1 text-[#DC2626]" aria-hidden="true">&#9679;</span>
                  <span class="sr-only">{{ 'productForm.hasErrors' | transloco }}</span>
                }
              </button>
            }
          </div>

          @if (tab() === 'basics') {
            <div id="panel-basics" role="tabpanel" aria-labelledby="tab-basics" class="space-y-4">
              <div class="grid gap-4 sm:grid-cols-2">
                <app-form-field [label]="'products.sku' | transloco" inputId="product-sku" [control]="form.controls.sku" [required]="true">
                  <input id="product-sku" dir="ltr" formControlName="sku" [class]="inputClass" />
                </app-form-field>
                <app-form-field [label]="'products.barcode' | transloco" inputId="product-barcode" [control]="form.controls.barcode">
                  <input id="product-barcode" dir="ltr" formControlName="barcode" [class]="inputClass" />
                </app-form-field>
              </div>

              <app-form-field [label]="'products.name' | transloco" inputId="product-name" [control]="form.controls.name" [required]="true">
                <input id="product-name" formControlName="name" [class]="inputClass" />
              </app-form-field>

              <div class="grid gap-4 sm:grid-cols-2">
                <app-form-field [label]="'products.brand' | transloco" inputId="product-brand" [control]="form.controls.brandId" [required]="true">
                  <select id="product-brand" formControlName="brandId" [class]="inputClass">
                    <option [ngValue]="null">{{ 'products.none' | transloco }}</option>
                    @for (b of brands(); track b.id) {
                      <option [ngValue]="b.id">{{ b.name }}</option>
                    }
                  </select>
                </app-form-field>
                <app-form-field [label]="'products.category' | transloco" inputId="product-category" [control]="form.controls.categoryId" [required]="true">
                  <select id="product-category" formControlName="categoryId" [class]="inputClass">
                    <option [ngValue]="null">{{ 'products.none' | transloco }}</option>
                    @for (c of categoryOptions(); track c.row.id) {
                      <option [ngValue]="c.row.id">{{ prefix(c.depth) }}{{ c.row.name }}</option>
                    }
                  </select>
                </app-form-field>
              </div>

              <fieldset class="space-y-2">
                <legend class="mb-1 text-sm font-medium">{{ 'products.tracking' | transloco }}</legend>
                <div class="grid gap-3 sm:grid-cols-2">
                  @for (m of trackingModes; track m) {
                    <label
                      class="flex min-h-12 cursor-pointer items-start gap-3 rounded-[10px] border border-slate-300 p-3 has-[:checked]:border-[#2563EB] has-[:checked]:ring-1 has-[:checked]:ring-[#2563EB] dark:border-slate-600"
                    >
                      <input type="radio" formControlName="tracking" [value]="m" class="mt-1 size-5" />
                      <span>
                        <span class="block text-sm font-medium">{{ 'products.' + m | transloco }}</span>
                        <span class="block text-xs text-[#5B6679]">{{ 'productForm.' + m + 'Hint' | transloco }}</span>
                      </span>
                    </label>
                  }
                </div>
              </fieldset>

              <label class="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" formControlName="isActive" class="size-5" />
                {{ 'products.active' | transloco }}
              </label>
            </div>
          } @else {
            <div id="panel-specs" role="tabpanel" aria-labelledby="tab-specs" formGroupName="specs" class="space-y-4">
              <p class="text-sm text-[#5B6679]">{{ 'productForm.specsHint' | transloco }}</p>
              <div class="grid gap-4 sm:grid-cols-2">
                <app-form-field [label]="'productForm.cpu' | transloco" inputId="product-cpu" [control]="form.controls.specs.controls.cpu">
                  <input id="product-cpu" formControlName="cpu" list="dl-cpu" [class]="inputClass" />
                </app-form-field>
                <app-form-field [label]="'productForm.ram' | transloco" inputId="product-ram" [control]="form.controls.specs.controls.ram">
                  <input id="product-ram" formControlName="ram" list="dl-ram" [class]="inputClass" />
                </app-form-field>
                <app-form-field [label]="'productForm.storage' | transloco" inputId="product-storage" [control]="form.controls.specs.controls.storage">
                  <input id="product-storage" formControlName="storage" list="dl-storage" [class]="inputClass" />
                </app-form-field>
                <app-form-field [label]="'productForm.gpu' | transloco" inputId="product-gpu" [control]="form.controls.specs.controls.gpu">
                  <input id="product-gpu" formControlName="gpu" list="dl-gpu" [class]="inputClass" />
                </app-form-field>
                <app-form-field [label]="'productForm.screen' | transloco" inputId="product-screen" [control]="form.controls.specs.controls.screen">
                  <input id="product-screen" formControlName="screen" list="dl-screen" [class]="inputClass" />
                </app-form-field>
              </div>
              <datalist id="dl-cpu">@for (s of cpuOptions; track s) { <option [value]="s"></option> }</datalist>
              <datalist id="dl-ram">@for (s of ramOptions; track s) { <option [value]="s"></option> }</datalist>
              <datalist id="dl-storage">@for (s of storageOptions; track s) { <option [value]="s"></option> }</datalist>
              <datalist id="dl-gpu">@for (s of gpuOptions; track s) { <option [value]="s"></option> }</datalist>
              <datalist id="dl-screen">@for (s of screenOptions; track s) { <option [value]="s"></option> }</datalist>
            </div>
          }

          <div class="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-700">
            <button type="button" class="min-h-12 rounded-lg border border-slate-400 px-5" (click)="back()">
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
      }
    </section>
  `,
})
export class ProductFormPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ProductsService);
  private readonly store = inject(ProductsStore);
  private readonly brandsApi = inject(BrandsService);
  private readonly categoriesApi = inject(CategoriesService);
  private readonly i18n = inject(TranslocoService);
  private readonly fb = inject(FormBuilder);

  protected readonly inputClass = INPUT;
  protected readonly tabs = TABS;
  protected readonly trackingModes = ['serialized', 'batch'] as const;
  protected readonly cpuOptions = CPU_SUGGESTIONS;
  protected readonly ramOptions = RAM_SUGGESTIONS;
  protected readonly storageOptions = STORAGE_SUGGESTIONS;
  protected readonly gpuOptions = GPU_SUGGESTIONS;
  protected readonly screenOptions = SCREEN_SUGGESTIONS;

  protected readonly productId: number | null = Number(this.route.snapshot.paramMap.get('id')) || null;
  protected readonly isEdit = this.productId !== null;

  protected readonly tab = signal<TabId>('basics');
  protected readonly tabErrors = signal<Record<TabId, boolean>>({ basics: false, specs: false });
  protected readonly loading = signal(this.isEdit);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly brands = signal<Brand[]>([]);
  protected readonly categories = signal<Category[]>([]);
  protected readonly categoryOptions = computed(() => flattenCategories(this.categories(), new Set<number>()));

  private submitted = false;

  protected readonly form = this.fb.nonNullable.group({
    sku: ['', [Validators.required, Validators.maxLength(50)]],
    name: ['', [Validators.required, Validators.maxLength(150)]],
    barcode: ['', [Validators.maxLength(64)]],
    brandId: this.fb.control<number | null>(null, Validators.required),
    categoryId: this.fb.control<number | null>(null, Validators.required),
    tracking: ['serialized' as 'serialized' | 'batch'],
    isActive: [true],
    specs: this.fb.nonNullable.group({
      cpu: ['', [Validators.maxLength(80)]],
      ram: ['', [Validators.maxLength(80)]],
      storage: ['', [Validators.maxLength(80)]],
      gpu: ['', [Validators.maxLength(80)]],
      screen: ['', [Validators.maxLength(80)]],
    }),
  });

  constructor() {
    // Submit ke baad galti theek hote hi tab ka laal dot hat jaye.
    this.form.statusChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.submitted) this.refreshErrors();
    });
  }

  ngOnInit(): void {
    void this.loadLookups();
    if (this.isEdit) void this.loadProduct();
  }

  protected prefix(depth: number): string {
    return depth > 0 ? '\u2014 '.repeat(depth) : '';
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
      // Dropdown khali rahenge; error toast interceptor dikhata hai.
    }
  }

  protected async loadProduct(): Promise<void> {
    if (this.productId === null) return;
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const p = await firstValueFrom(this.api.get(this.productId));
      this.form.reset({
        sku: p.sku,
        name: p.name,
        barcode: p.barcode ?? '',
        brandId: p.brandId,
        categoryId: p.categoryId,
        tracking: p.trackBatch ? 'batch' : 'serialized',
        isActive: p.isActive,
        specs: {
          cpu: p.specs?.cpu ?? '',
          ram: p.specs?.ram ?? '',
          storage: p.specs?.storage ?? '',
          gpu: p.specs?.gpu ?? '',
          screen: p.specs?.screen ?? '',
        },
      });
    } catch {
      this.loadError.set(this.i18n.translate('productForm.loadFailed'));
    } finally {
      this.loading.set(false);
    }
  }

  protected selectTab(id: TabId, focus = false): void {
    this.tab.set(id);
    if (focus) queueMicrotask(() => document.getElementById(`tab-${id}`)?.focus());
  }

  protected onTabKey(e: KeyboardEvent): void {
    const i = TABS.indexOf(this.tab());
    let next = i;
    if (e.key === 'ArrowRight') next = (i + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    else return;
    e.preventDefault();
    this.selectTab(TABS[next], true);
  }

  private refreshErrors(): void {
    const c = this.form.controls;
    this.tabErrors.set({
      basics: [c.sku, c.name, c.barcode, c.brandId, c.categoryId].some((x) => x.invalid),
      specs: c.specs.invalid,
    });
  }

  protected back(): void {
    void this.router.navigate(['/products/list']);
  }

  protected async submit(): Promise<void> {
    this.submitted = true;
    this.form.markAllAsTouched();
    this.refreshErrors();
    if (this.form.invalid) {
      const first = TABS.find((t) => this.tabErrors()[t]);
      if (first) this.tab.set(first);
      return;
    }
    this.saving.set(true);
    const v = this.form.getRawValue();
    const body: ProductInput = {
      sku: v.sku.trim(),
      name: v.name.trim(),
      barcode: v.barcode.trim() || null,
      brandId: v.brandId,
      categoryId: v.categoryId,
      trackBatch: v.tracking === 'batch',
      specs: {
        cpu: v.specs.cpu.trim(),
        ram: v.specs.ram.trim(),
        storage: v.specs.storage.trim(),
        gpu: v.specs.gpu.trim(),
        screen: v.specs.screen.trim(),
      },
      isActive: v.isActive,
    };
    const err = await this.store.save(this.productId, body);
    this.saving.set(false);
    if (err) {
      const target = /sku/i.test(err) ? this.form.controls.sku : this.form.controls.name;
      target.setErrors({ server: err });
      this.refreshErrors();
      this.tab.set('basics');
      return;
    }
    this.back();
  }
}