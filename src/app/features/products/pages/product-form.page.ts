import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormArray, FormBuilder, NonNullableFormBuilder, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { FormFieldComponent } from '../../../shared/ui/form-field/form-field.component';
import { Branch } from '../../settings/models/org.models';
import { PriceTierCode } from '../../settings/models/settings.models';
import { Brand, Category, ProductImage, ProductInput, ProductPrice, ProductVariant } from '../models';
import { BranchLookupService } from '../services/branch-lookup.service';
import { ProductPriceChange, ProductPriceHistoryService } from '../services/price-history.service';
import { BrandsService, CategoriesService, ProductsService } from '../services/products.service';
import { ProductsStore } from '../stores/products.stores';
import { flattenCategories } from '../utils/category-tree';
import { MAX_IMAGES, checkImageFile, ensureSinglePrimary, readFileAsDataUrl, removeImageAt, setPrimaryAt } from '../utils/image-utils';
import { duplicateSkus, formatMoney, priceFor } from '../utils/product-utils';

type TabId = 'basics' | 'specs' | 'variants' | 'pricing' | 'stock' | 'images';
const TABS: readonly TabId[] = ['basics', 'specs', 'variants', 'pricing', 'stock', 'images'];
const TIERS: readonly PriceTierCode[] = ['retail', 'wholesale', 'dealer'];

const CPU_SUGGESTIONS = ['Intel Core i3', 'Intel Core i5', 'Intel Core i7', 'Intel Core i9', 'AMD Ryzen 5', 'AMD Ryzen 7'];
const RAM_SUGGESTIONS = ['4 GB', '8 GB', '16 GB', '32 GB', '64 GB'];
const STORAGE_SUGGESTIONS = ['256 GB SSD', '512 GB SSD', '1 TB SSD', '1 TB HDD', '2 TB HDD'];
const GPU_SUGGESTIONS = ['Integrated', 'NVIDIA GeForce RTX 3050', 'NVIDIA GeForce RTX 4060', 'AMD Radeon'];
const SCREEN_SUGGESTIONS = ['13.3"', '14"', '15.6"', '17.3"', '24"'];

const INPUT = 'min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm';

function variantGroup(fb: NonNullableFormBuilder, skuCheck: ValidatorFn, barcodeCheck: ValidatorFn, v?: ProductVariant) {
  return fb.group({
    id: fb.control<number | null>(v?.id ?? null),
    sku: fb.control(v?.sku ?? '', [Validators.required, Validators.maxLength(50), skuCheck]),
    name: fb.control(v?.name ?? '', [Validators.required, Validators.maxLength(150)]),
    barcode: fb.control(v?.barcode ?? '', [Validators.maxLength(64), barcodeCheck]),
    isActive: fb.control(v?.isActive ?? true),
  });
}
type VariantGroup = ReturnType<typeof variantGroup>;

function reorderGroup(fb: NonNullableFormBuilder, branchId: number, level: number | null) {
  return fb.group({
    branchId: fb.control(branchId),
    level: fb.control<number | null>(level, [Validators.min(0), Validators.pattern(/^\d+$/)]),
  });
}
type ReorderGroup = ReturnType<typeof reorderGroup>;

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

          @switch (tab()) {
            @case ('basics') {
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
            }

            @case ('specs') {
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

            @case ('variants') {
              <div id="panel-variants" role="tabpanel" aria-labelledby="tab-variants" class="space-y-4">
                <p class="text-sm text-[#5B6679]">{{ 'productForm.variantsHint' | transloco }}</p>

                @if (form.controls.variants.length === 0) {
                  <p class="rounded-[10px] border border-dashed border-slate-300 p-4 text-sm text-[#5B6679] dark:border-slate-600">
                    {{ 'productForm.noVariants' | transloco }}
                  </p>
                }

                <div formArrayName="variants" class="space-y-3">
                  @for (g of form.controls.variants.controls; track g; let i = $index) {
                    <div [formGroupName]="i" class="space-y-3 rounded-[10px] border border-slate-200 p-4 dark:border-slate-700">
                      <div class="flex items-center justify-between gap-2">
                        <h2 class="text-sm font-semibold">{{ 'productForm.variantTitle' | transloco }} {{ i + 1 }}</h2>
                        <button
                          type="button"
                          class="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#DC2626] px-4 text-sm text-[#DC2626]"
                          [attr.aria-label]="('productForm.removeVariant' | transloco) + ' ' + (i + 1)"
                          (click)="removeVariant(i)"
                        >
                          <i class="pi pi-trash" aria-hidden="true"></i>
                          {{ 'productForm.removeVariant' | transloco }}
                        </button>
                      </div>
                      <div class="grid gap-4 sm:grid-cols-2">
                        <app-form-field [label]="'productForm.variantSku' | transloco" [inputId]="'variant-sku-' + i" [control]="g.controls.sku" [required]="true">
                          <input [id]="'variant-sku-' + i" dir="ltr" formControlName="sku" [class]="inputClass" />
                        </app-form-field>
                        <app-form-field [label]="'productForm.variantName' | transloco" [inputId]="'variant-name-' + i" [control]="g.controls.name" [required]="true">
                          <input [id]="'variant-name-' + i" formControlName="name" [class]="inputClass" />
                        </app-form-field>
                        <app-form-field [label]="'productForm.variantBarcode' | transloco" [inputId]="'variant-barcode-' + i" [control]="g.controls.barcode">
                          <input [id]="'variant-barcode-' + i" dir="ltr" formControlName="barcode" [class]="inputClass" />
                        </app-form-field>
                        <label class="flex min-h-11 items-center gap-2 self-end text-sm">
                          <input type="checkbox" formControlName="isActive" class="size-5" />
                          {{ 'products.active' | transloco }}
                        </label>
                      </div>
                    </div>
                  }
                </div>

                <button
                  type="button"
                  class="min-h-12 rounded-lg border border-[#2563EB] px-5 text-sm font-medium text-[#2563EB]"
                  (click)="addVariant()"
                >
                  {{ 'productForm.addVariant' | transloco }}
                </button>
              </div>
            }

            @case ('pricing') {
              <div id="panel-pricing" role="tabpanel" aria-labelledby="tab-pricing" formGroupName="pricing" class="space-y-4">
                <p class="text-sm text-[#5B6679]">{{ 'productForm.pricingHint' | transloco }}</p>
                <div class="grid gap-4 sm:grid-cols-2">
                  @if (canCost) {
                    <app-form-field [label]="'productForm.costPrice' | transloco" inputId="product-cost" [control]="form.controls.pricing.controls.costPrice">
                      <input id="product-cost" type="number" inputmode="decimal" min="0" step="0.01" dir="ltr" formControlName="costPrice" [class]="inputClass" />
                    </app-form-field>
                  }
                  <app-form-field [label]="'productForm.minPrice' | transloco" inputId="product-min-price" [control]="form.controls.pricing.controls.minPrice">
                    <input id="product-min-price" type="number" inputmode="decimal" min="0" step="0.01" dir="ltr" formControlName="minPrice" [class]="inputClass" />
                  </app-form-field>
                </div>
                @if (canCost) {
                  <p class="text-xs text-[#5B6679]">{{ 'productForm.costHint' | transloco }}</p>
                }
                <p class="text-xs text-[#5B6679]">{{ 'productForm.minPriceHint' | transloco }}</p>

                <div class="grid gap-4 sm:grid-cols-3">
                  @for (t of tiers; track t) {
                    <app-form-field
                      [label]="'productForm.tiers.' + t | transloco"
                      [inputId]="'product-price-' + t"
                      [control]="form.controls.pricing.controls[t]"
                    >
                      <input
                        [id]="'product-price-' + t"
                        type="number"
                        inputmode="decimal"
                        min="0"
                        step="0.01"
                        dir="ltr"
                        [formControlName]="t"
                        [class]="inputClass"
                      />
                    </app-form-field>
                  }
                </div>
                @if (isEdit) {
                  <section class="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-700" aria-labelledby="price-history-title">
                    <h2 id="price-history-title" class="text-sm font-semibold">{{ 'productForm.historyTitle' | transloco }}</h2>
                    @if (historyError()) {
                      <div role="alert" class="space-y-2 rounded-[10px] border border-red-600 p-3 text-sm text-red-600">
                        <p>{{ 'productForm.historyFailed' | transloco }}</p>
                        <button type="button" class="min-h-11 rounded-lg border border-red-600 px-4" (click)="loadHistory()">
                          {{ 'productForm.retry' | transloco }}
                        </button>
                      </div>
                    } @else if (history().length === 0) {
                      <p class="rounded-[10px] border border-dashed border-slate-300 p-4 text-sm text-[#5B6679] dark:border-slate-600">
                        {{ 'productForm.historyNone' | transloco }}
                      </p>
                    } @else {
                      <div class="overflow-x-auto rounded-[10px] border border-slate-200 dark:border-slate-700">
                        <table class="w-full min-w-max text-sm">
                          <thead class="text-xs text-[#5B6679]">
                            <tr>
                              <th scope="col" class="px-3 py-2 text-start">{{ 'productForm.historyDate' | transloco }}</th>
                              <th scope="col" class="px-3 py-2 text-start">{{ 'productForm.historyTier' | transloco }}</th>
                              <th scope="col" class="px-3 py-2 text-end">{{ 'productForm.historyOld' | transloco }}</th>
                              <th scope="col" class="px-3 py-2 text-end">{{ 'productForm.historyNew' | transloco }}</th>
                              <th scope="col" class="px-3 py-2 text-start">{{ 'productForm.historyBy' | transloco }}</th>
                            </tr>
                          </thead>
                          <tbody class="divide-y divide-slate-200 dark:divide-slate-700">
                            @for (h of history(); track h.id) {
                              <tr>
                                <td class="px-3 py-2">{{ when(h.changedAt) }}</td>
                                <td class="px-3 py-2">{{ 'productForm.tiers.' + h.tier | transloco }}</td>
                                <td class="px-3 py-2 text-end tabular-nums">{{ money(h.oldPrice) }}</td>
                                <td class="px-3 py-2 text-end tabular-nums">{{ money(h.newPrice) }}</td>
                                <td class="px-3 py-2">{{ h.changedBy }}</td>
                              </tr>
                            }
                          </tbody>
                        </table>
                      </div>
                    }
                  </section>
                }
              </div>
            }

            @case ('stock') {
              <div id="panel-stock" role="tabpanel" aria-labelledby="tab-stock" class="space-y-6">
                <div class="space-y-1">
                  <app-form-field [label]="'productForm.warranty' | transloco" inputId="product-warranty" [control]="form.controls.warrantyMonths" [required]="true">
                    <input id="product-warranty" type="number" inputmode="numeric" min="0" max="120" step="1" dir="ltr" formControlName="warrantyMonths" [class]="inputClass" />
                  </app-form-field>
                  <p class="text-xs text-[#5B6679]">{{ 'productForm.warrantyHint' | transloco }}</p>
                </div>

                <fieldset class="space-y-3">
                  <legend class="text-sm font-medium">{{ 'productForm.reorderTitle' | transloco }}</legend>
                  <p class="text-xs text-[#5B6679]">{{ 'productForm.reorderHint' | transloco }}</p>

                  @if (branchError()) {
                    <div role="alert" class="space-y-3 rounded-[10px] border border-red-600 p-3 text-sm text-red-600">
                      <p>{{ 'productForm.reorderLoadFailed' | transloco }}</p>
                      <button type="button" class="min-h-11 rounded-lg border border-red-600 px-4" (click)="loadBranches()">
                        {{ 'productForm.retry' | transloco }}
                      </button>
                    </div>
                  } @else if (!branchesLoaded()) {
                    <p role="status" class="text-sm text-[#5B6679]">{{ 'productForm.reorderLoading' | transloco }}</p>
                  } @else if (form.controls.reorderLevels.length === 0) {
                    <p class="rounded-[10px] border border-dashed border-slate-300 p-4 text-sm text-[#5B6679] dark:border-slate-600">
                      {{ 'productForm.reorderNone' | transloco }}
                    </p>
                  } @else {
                    <div formArrayName="reorderLevels" class="grid gap-3 sm:grid-cols-2">
                      @for (g of form.controls.reorderLevels.controls; track g; let i = $index) {
                        <div [formGroupName]="i" class="space-y-1">
                          <label [attr.for]="'reorder-' + i" class="block text-sm">{{ branchName(g.controls.branchId.value) }}</label>
                          <input
                            [id]="'reorder-' + i"
                            type="number"
                            inputmode="numeric"
                            min="0"
                            step="1"
                            dir="ltr"
                            formControlName="level"
                            [class]="inputClass"
                          />
                        </div>
                      }
                    </div>
                  }
                </fieldset>
              </div>
            }

            @case ('images') {
              <div id="panel-images" role="tabpanel" aria-labelledby="tab-images" class="space-y-4">
                <p class="text-sm text-[#5B6679]">{{ 'productForm.imagesHint' | transloco }}</p>

                @if (imageError(); as msg) {
                  <p role="alert" class="rounded-lg border border-red-600 p-3 text-sm text-red-600">{{ msg }}</p>
                }

                @if (images().length === 0) {
                  <p class="rounded-[10px] border border-dashed border-slate-300 p-4 text-sm text-[#5B6679] dark:border-slate-600">
                    {{ 'productForm.noImages' | transloco }}
                  </p>
                } @else {
                  <ul class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    @for (img of images(); track $index; let i = $index) {
                      <li class="space-y-2 rounded-[10px] border border-slate-200 p-2 dark:border-slate-700">
                        <img [src]="img.url" [alt]="img.name" class="aspect-square w-full rounded-lg object-cover" />
                        <button
                          type="button"
                          class="min-h-11 w-full rounded-lg border px-3 text-sm"
                          [class.border-[#2563EB]]="img.isPrimary"
                          [class.text-[#2563EB]]="img.isPrimary"
                          [class.border-slate-400]="!img.isPrimary"
                          [attr.aria-pressed]="img.isPrimary"
                          (click)="makeMain(i)"
                        >
                          {{ (img.isPrimary ? 'productForm.mainImage' : 'productForm.setMain') | transloco }}
                        </button>
                        <button
                          type="button"
                          class="min-h-11 w-full rounded-lg border border-[#DC2626] px-3 text-sm text-[#DC2626]"
                          [attr.aria-label]="('productForm.removeImage' | transloco) + ' ' + (i + 1)"
                          (click)="removeImage(i)"
                        >
                          {{ 'productForm.removeImage' | transloco }}
                        </button>
                      </li>
                    }
                  </ul>
                }

                <div class="flex flex-wrap items-center gap-3">
                  <label
                    class="inline-flex min-h-12 cursor-pointer items-center rounded-lg border border-[#2563EB] px-5 text-sm font-medium text-[#2563EB] focus-within:ring-2 focus-within:ring-[#2563EB]"
                    [class.opacity-50]="images().length >= maxImages"
                  >
                    {{ 'productForm.addImages' | transloco }}
                    <input
                      id="product-images"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      class="sr-only"
                      [disabled]="images().length >= maxImages"
                      (change)="onFiles($event)"
                    />
                  </label>
                  <span class="text-xs text-[#5B6679]">{{ images().length }} / {{ maxImages }}</span>
                </div>
              </div>
            }
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
  private readonly branchApi = inject(BranchLookupService);
  private readonly auth = inject(AuthStore);
  private readonly i18n = inject(TranslocoService);
  private readonly fb = inject(FormBuilder);

  protected readonly inputClass = INPUT;
  protected readonly tabs = TABS;
  protected readonly tiers = TIERS;
  protected readonly trackingModes = ['serialized', 'batch'] as const;
  protected readonly cpuOptions = CPU_SUGGESTIONS;
  protected readonly ramOptions = RAM_SUGGESTIONS;
  protected readonly storageOptions = STORAGE_SUGGESTIONS;
  protected readonly gpuOptions = GPU_SUGGESTIONS;
  protected readonly screenOptions = SCREEN_SUGGESTIONS;

  /** Cost price sirf products.cost.view wale ko dikhta aur jata hai. */
  protected readonly canCost = this.auth.can('products.cost.view');

  protected readonly productId: number | null = Number(this.route.snapshot.paramMap.get('id')) || null;
  protected readonly isEdit = this.productId !== null;

  protected readonly tab = signal<TabId>('basics');
  protected readonly tabErrors = signal<Record<TabId, boolean>>({
    basics: false,
    specs: false,
    variants: false,
    pricing: false,
    stock: false,
    images: false,
  });
  protected readonly loading = signal(this.isEdit);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly brands = signal<Brand[]>([]);
  protected readonly categories = signal<Category[]>([]);
  protected readonly categoryOptions = computed(() => flattenCategories(this.categories(), new Set<number>()));
  protected readonly branches = signal<Branch[]>([]);
  protected readonly branchesLoaded = signal(false);
  protected readonly branchError = signal(false);
  private readonly branchNames = computed(
    () => new Map<number, string>(this.branches().map((b) => [b.id, b.name] as [number, string])),
  );

  private submitted = false;
  /** Branch -> reorder level. Product aur branches alag waqt par aate hain, isliye yahan jama hota hai. */
  private savedLevels = new Map<number, number>();

  /** Koi tier minimum price (floor) se kam na ho. Floor badalne par constructor dobara check karta hai. */
  private readonly floorCheck: ValidatorFn = (c) => {
    const min = c.parent?.get('minPrice')?.value as number | null | undefined;
    const v = c.value as number | null;
    return min !== null && min !== undefined && v !== null && v < min
      ? { server: this.i18n.translate('productForm.floorViolation') }
      : null;
  };

  /** Variant SKU product ki SKU ke barabar ya kisi doosre variant jaisi na ho. */
  private readonly variantSkuCheck: ValidatorFn = (c) => {
    const s = String(c.value ?? '').trim().toLowerCase();
    const arr = c.parent?.parent as FormArray | null | undefined;
    if (!s || !arr) return null;
    if (s === this.form.controls.sku.value.trim().toLowerCase()) {
      return { server: this.i18n.translate('productForm.variantSkuSameAsProduct') };
    }
    const all = arr.controls.map((x) => String(x.get('sku')?.value ?? ''));
    return duplicateSkus(all).has(s) ? { server: this.i18n.translate('productForm.variantSkuDuplicate') } : null;
  };

  /** Barcode mein space ya ajeeb character na ho, aur product/variants mein dobara na aaye. */
  private readonly barcodeCheck: ValidatorFn = (c) => {
    const code = String(c.value ?? '').trim();
    if (!code) return null;
    if (!/^[\x21-\x7E]+$/.test(code)) return { server: this.i18n.translate('productForm.barcodeFormat') };
    const all = [
      this.form.controls.barcode.value,
      ...this.form.controls.variants.controls.map((g) => g.controls.barcode.value),
    ];
    return duplicateSkus(all).has(code.toLowerCase())
      ? { server: this.i18n.translate('productForm.barcodeDuplicate') }
      : null;
  };

  protected readonly form = this.fb.nonNullable.group({
    sku: ['', [Validators.required, Validators.maxLength(50)]],
    name: ['', [Validators.required, Validators.maxLength(150)]],
    barcode: ['', [Validators.maxLength(64), this.barcodeCheck]],
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
    variants: this.fb.array<VariantGroup>([]),
    pricing: this.fb.nonNullable.group({
      costPrice: this.fb.control<number | null>(null, [Validators.min(0)]),
      minPrice: this.fb.control<number | null>(null, [Validators.min(0)]),
      retail: this.fb.control<number | null>(null, [Validators.min(0), this.floorCheck]),
      wholesale: this.fb.control<number | null>(null, [Validators.min(0), this.floorCheck]),
      dealer: this.fb.control<number | null>(null, [Validators.min(0), this.floorCheck]),
    }),
    warrantyMonths: this.fb.nonNullable.control(0, [
      Validators.required,
      Validators.min(0),
      Validators.max(120),
      Validators.pattern(/^\d+$/),
    ]),
    reorderLevels: this.fb.array<ReorderGroup>([]),
  });

  constructor() {
    // Submit ke baad galti theek hote hi tab ka laal dot hat jaye.
    this.form.statusChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      if (this.submitted) this.refreshErrors();
    });
    // Floor ya SKU badalne par dusre fields dobara check hote hain.
    const prices = this.form.controls.pricing.controls;
    prices.minPrice.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      for (const t of TIERS) prices[t].updateValueAndValidity();
    });
    const recheck = () => this.recheckVariantSkus();
    this.form.controls.sku.valueChanges.pipe(takeUntilDestroyed()).subscribe(recheck);
    this.form.controls.barcode.valueChanges.pipe(takeUntilDestroyed()).subscribe(recheck);
    this.form.controls.variants.valueChanges.pipe(takeUntilDestroyed()).subscribe(recheck);
  }

  ngOnInit(): void {
    void this.loadLookups();
    void this.loadBranches();
    if (this.isEdit) void this.loadProduct();
  }

  protected prefix(depth: number): string {
    return depth > 0 ? '\u2014 '.repeat(depth) : '';
  }

  protected branchName(id: number): string {
    return this.branchNames().get(id) ?? `#${id}`;
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

  protected async loadBranches(): Promise<void> {
    this.branchError.set(false);
    this.branchesLoaded.set(false);
    try {
      const res = await firstValueFrom(this.branchApi.list({ pageSize: 200 }));
      this.branches.set(res.data.filter((b) => b.isActive));
      this.buildReorder();
    } catch {
      this.branchError.set(true);
    } finally {
      this.branchesLoaded.set(true);
    }
  }

  /** Har active branch ke liye ek reorder-level box banata hai, purani values bachate hue. */
  private buildReorder(): void {
    const arr = this.form.controls.reorderLevels;
    for (const g of arr.controls) {
      const lv = g.controls.level.value;
      if (lv !== null) this.savedLevels.set(g.controls.branchId.value, lv);
    }
    arr.clear();
    for (const b of this.branches()) {
      arr.push(reorderGroup(this.fb.nonNullable, b.id, this.savedLevels.get(b.id) ?? null));
    }
  }

  protected async loadProduct(): Promise<void> {
    if (this.productId === null) return;
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const p = await firstValueFrom(this.api.get(this.productId));
      this.form.patchValue({
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
        pricing: {
          costPrice: p.costPrice ?? null,
          minPrice: p.minPrice ?? null,
          retail: priceFor(p, 'retail'),
          wholesale: priceFor(p, 'wholesale'),
          dealer: priceFor(p, 'dealer'),
        },
        warrantyMonths: p.warrantyMonths ?? 0,
      });
      this.images.set(ensureSinglePrimary(p.images ?? []));
      void this.loadHistory();
      const variants = this.form.controls.variants;
      variants.clear();
      for (const v of p.variants ?? []) {
        variants.push(variantGroup(this.fb.nonNullable, this.variantSkuCheck, this.barcodeCheck, v));
      }
      this.savedLevels = new Map<number, number>(
        (p.reorderLevels ?? []).map((r) => [r.branchId, r.level] as [number, number]),
      );
      this.buildReorder();
    } catch {
      this.loadError.set(this.i18n.translate('productForm.loadFailed'));
    } finally {
      this.loading.set(false);
    }
  }

  private readonly historyApi = inject(ProductPriceHistoryService);
  protected readonly history = signal<ProductPriceChange[]>([]);
  protected readonly historyError = signal(false);
  protected readonly money = formatMoney;

  protected when(iso: string): string {
    return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  }

  private async loadHistory(): Promise<void> {
    if (this.productId === null) return;
    this.historyError.set(false);
    try {
      const rows = await firstValueFrom(this.historyApi.list(this.productId));
      this.history.set([...rows].sort((a, b) => b.changedAt.localeCompare(a.changedAt)));
    } catch {
      this.historyError.set(true);
    }
  }

  protected readonly maxImages = MAX_IMAGES;
  protected readonly images = signal<ProductImage[]>([]);
  protected readonly imageError = signal<string | null>(null);

  protected async onFiles(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    this.imageError.set(null);
    const next = [...this.images()];
    for (const file of files) {
      if (next.length >= MAX_IMAGES) {
        this.imageError.set(this.i18n.translate('productForm.imagesTooMany', { max: MAX_IMAGES }));
        break;
      }
      const problem = checkImageFile(file);
      if (problem) {
        const key = problem === 'type' ? 'productForm.imageBadType' : 'productForm.imageTooBig';
        this.imageError.set(this.i18n.translate(key, { name: file.name }));
        continue;
      }
      try {
        next.push({ url: await readFileAsDataUrl(file), name: file.name, isPrimary: false });
      } catch {
        this.imageError.set(this.i18n.translate('productForm.imageReadFailed', { name: file.name }));
      }
    }
    this.images.set(ensureSinglePrimary(next));
  }

  protected makeMain(index: number): void {
    this.images.set(setPrimaryAt(this.images(), index));
  }

  protected removeImage(index: number): void {
    this.images.set(removeImageAt(this.images(), index));
    this.imageError.set(null);
  }

  protected addVariant(): void {
    this.form.controls.variants.push(variantGroup(this.fb.nonNullable, this.variantSkuCheck, this.barcodeCheck));
    if (this.submitted) this.refreshErrors();
  }

  protected removeVariant(index: number): void {
    this.form.controls.variants.removeAt(index);
    if (this.submitted) this.refreshErrors();
  }

  protected selectTab(id: TabId, focus = false): void {
    this.tab.set(id);
    if (focus) queueMicrotask(() => document.getElementById(`tab-${id}`)?.focus());
  }

  protected onTabKey(e: KeyboardEvent): void {
    const i = TABS.indexOf(this.tab());
    let next: number;
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
      variants: c.variants.invalid,
      pricing: c.pricing.invalid,
      stock: c.warrantyMonths.invalid || c.reorderLevels.invalid,
      images: false,
    });
  }

  /** Sab variant SKUs ko dobara check karta hai (product SKU ya doosre variant badalne par). */
  private recheckVariantSkus(): void {
    this.form.controls.barcode.updateValueAndValidity({ emitEvent: false });
    for (const g of this.form.controls.variants.controls) {
      g.controls.sku.updateValueAndValidity({ emitEvent: false });
      g.controls.barcode.updateValueAndValidity({ emitEvent: false });
    }
    if (this.submitted) this.refreshErrors();
  }

  protected back(): void {
    void this.router.navigate(['/products/list']);
  }

  protected async submit(): Promise<void> {
    this.submitted = true;
    this.form.markAllAsTouched();
    this.recheckVariantSkus();
    this.refreshErrors();
    if (this.form.invalid) {
      const first = TABS.find((t) => this.tabErrors()[t]);
      if (first) this.tab.set(first);
      return;
    }
    this.saving.set(true);
    const v = this.form.getRawValue();
    const prices: ProductPrice[] = TIERS.flatMap((tier) => {
      const price = v.pricing[tier];
      return price === null ? [] : [{ tier, price }];
    });
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
      warrantyMonths: v.warrantyMonths,
      minPrice: v.pricing.minPrice,
      prices,
      reorderLevels: v.reorderLevels.flatMap((r) =>
        r.level === null ? [] : [{ branchId: r.branchId, level: r.level }],
      ),
      variants: v.variants.map((x) => ({
        ...(x.id !== null ? { id: x.id } : {}),
        sku: x.sku.trim(),
        name: x.name.trim(),
        barcode: x.barcode.trim() || null,
        isActive: x.isActive,
      })),
      images: this.images(),
      isActive: v.isActive,
      // Bina permission ke costPrice bheja hi nahi jata, taake purani value overwrite na ho.
      ...(this.canCost ? { costPrice: v.pricing.costPrice } : {}),
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