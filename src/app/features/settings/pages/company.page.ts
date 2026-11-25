import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { FormFieldComponent } from '../../../shared/ui/form-field/form-field.component';
import { CURRENCIES } from '../models/settings.models';
import { SettingsStore } from '../stores/settings.store';

const MAX_LOGO_BYTES = 512 * 1024;

@Component({
  selector: 'app-company-page',
  imports: [ReactiveFormsModule, TranslocoPipe, FormFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-3xl space-y-4">
      <h1 class="text-xl font-semibold">{{ 'settingsPage.company.title' | transloco }}</h1>

      @if (loadError(); as msg) {
        <div role="alert" class="rounded-xl border border-red-600 p-4 text-sm text-red-600">
          <p>{{ msg }}</p>
          <button type="button" class="mt-3 min-h-12 rounded-lg border border-red-600 px-5" (click)="load()">
            {{ 'common.retry' | transloco }}
          </button>
        </div>
      } @else if (!loaded()) {
        <div role="status" class="animate-pulse space-y-3">
          <span class="sr-only">{{ 'state.loading' | transloco }}</span>
          <div class="h-11 rounded-lg bg-slate-200 dark:bg-slate-700"></div>
          <div class="h-11 rounded-lg bg-slate-200 dark:bg-slate-700"></div>
          <div class="h-24 rounded-lg bg-slate-200 dark:bg-slate-700"></div>
        </div>
      } @else {
        <form
          [formGroup]="form"
          (ngSubmit)="submit()"
          class="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
        >
          <app-form-field
            [label]="'settingsPage.company.name' | transloco"
            inputId="company-name"
            [control]="form.controls.name"
            [required]="true"
          >
            <input placeholder="Enter company name..."
              id="company-name"
              formControlName="name"
              class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm"
            />
          </app-form-field>

          <div class="space-y-2">
            <p class="text-sm font-medium">{{ 'settingsPage.company.logo' | transloco }}</p>
            <div class="flex flex-wrap items-center gap-3">
              @if (logo(); as src) {
                <img
                  [src]="src"
                  alt=""
                  class="h-16 max-w-40 rounded-lg border border-slate-300 object-contain p-1 dark:border-slate-600"
                />
              }
              <label
                class="inline-flex min-h-12 cursor-pointer items-center rounded-lg border border-slate-400 px-5 text-sm font-medium focus-within:ring-2 focus-within:ring-[#2563EB]"
              >
                {{ 'settingsPage.company.logoUpload' | transloco }}
                <input type="file" accept="image/png,image/jpeg,image/webp" class="sr-only" (change)="onLogo($event)" />
              </label>
              @if (logo()) {
                <button
                  type="button"
                  class="min-h-12 rounded-lg border border-slate-400 px-5 text-sm"
                  (click)="logo.set(null)"
                >
                  {{ 'settingsPage.company.logoRemove' | transloco }}
                </button>
              }
            </div>
            <p class="text-xs text-slate-600 dark:text-slate-400">{{ 'settingsPage.company.logoHint' | transloco }}</p>
            @if (logoError(); as msg) {
              <p role="alert" class="text-sm text-red-600">{{ msg }}</p>
            }
          </div>

          <app-form-field
            [label]="'settingsPage.company.address' | transloco"
            inputId="company-address"
            [control]="form.controls.address"
          >
            <textarea placeholder="Enter company address..."
              id="company-address"
              formControlName="address"
              rows="3"
              class="min-h-24 w-full rounded-lg border border-slate-400 bg-transparent px-3 py-2 text-sm"
            ></textarea>
          </app-form-field>

          <div class="grid gap-4 sm:grid-cols-2">
            <app-form-field
              [label]="'settingsPage.company.city' | transloco"
              inputId="company-city"
              [control]="form.controls.city"
            >
              <input placeholder="Enter company city..."
                id="company-city"
                formControlName="city"
                class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm"
              />
            </app-form-field>
            <app-form-field
              [label]="'settingsPage.company.country' | transloco"
              inputId="company-country"
              [control]="form.controls.country"
            >
              <input placeholder="Enter company country..."
                id="company-country"
                formControlName="country"
                class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm"
              />
            </app-form-field>
            <app-form-field
              [label]="'settingsPage.company.phone' | transloco"
              inputId="company-phone"
              [control]="form.controls.phone"
            >
              <input placeholder="Enter company phone..."
                id="company-phone"
                type="tel"
                dir="ltr"
                formControlName="phone"
                class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm"
              />
            </app-form-field>
            <app-form-field
              [label]="'settingsPage.company.email' | transloco"
              inputId="company-email"
              [control]="form.controls.email"
            >
              <input placeholder="Enter company email..."
                id="company-email"
                type="email"
                dir="ltr"
                formControlName="email"
                class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm"
              />
            </app-form-field>
            <app-form-field
              [label]="'settingsPage.company.taxNumber' | transloco"
              inputId="company-tax"
              [control]="form.controls.taxNumber"
            >
              <input placeholder="Enter company tax..."
                id="company-tax"
                formControlName="taxNumber"
                class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm"
              />
            </app-form-field>
            <app-form-field
              [label]="'settingsPage.company.taxRate' | transloco"
              inputId="company-tax-rate"
              [control]="form.controls.taxRate"
              [required]="true"
            >
              <input placeholder="Enter company tax rate..."
                id="company-tax-rate"
                type="number"
                inputmode="decimal"
                min="0"
                max="100"
                step="0.01"
                formControlName="taxRate"
                class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm"
              />
            </app-form-field>
          </div>

          <app-form-field
            [label]="'settingsPage.company.currency' | transloco"
            inputId="company-currency"
            [control]="form.controls.currency"
            [required]="true"
          >
            <select
              id="company-currency"
              formControlName="currency"
              class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm"
            >
              @for (c of currencies; track c) {
                <option [value]="c">{{ c }}</option>
              }
            </select>
          </app-form-field>

          <div class="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              class="min-h-12 rounded-lg bg-[#2563EB] px-6 font-medium text-white disabled:opacity-50"
              [disabled]="saving()"
            >
              {{ 'common.save' | transloco }}
            </button>
            @if (saved()) {
              <p role="status" class="text-sm text-green-600">{{ 'settingsPage.saved' | transloco }}</p>
            }
            @if (saveError(); as msg) {
              <p role="alert" class="text-sm text-red-600">{{ msg }}</p>
            }
          </div>
        </form>
      }
    </section>
  `,
})
export class CompanyPage implements OnInit {
  protected readonly store = inject(SettingsStore);
  private readonly fb = inject(FormBuilder);
  private readonly i18n = inject(TranslocoService);

  protected readonly currencies = CURRENCIES;
  protected readonly loaded = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly saveError = signal<string | null>(null);
  protected readonly logo = signal<string | null>(null);
  protected readonly logoError = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    address: ['', [Validators.maxLength(300)]],
    city: ['', [Validators.maxLength(80)]],
    country: ['', [Validators.maxLength(80)]],
    phone: ['', [Validators.maxLength(40)]],
    email: ['', [Validators.email, Validators.maxLength(120)]],
    taxNumber: ['', [Validators.maxLength(40)]],
    taxRate: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    currency: ['PKR', [Validators.required]],
  });

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loadError.set(null);
    try {
      await this.store.loadCompany();
      const c = this.store.company();
      if (c) {
        this.form.reset({
          name: c.name,
          address: c.address,
          city: c.city,
          country: c.country,
          phone: c.phone,
          email: c.email,
          taxNumber: c.taxNumber,
          taxRate: c.taxRate,
          currency: c.currency,
        });
        this.logo.set(c.logo);
      }
      this.loaded.set(true);
    } catch {
      this.loadError.set(this.i18n.translate('errors.generic'));
    }
  }

  protected onLogo(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      this.logoError.set(this.i18n.translate('settingsPage.company.logoTooLarge'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.logo.set(String(reader.result));
      this.logoError.set(null);
    };
    reader.readAsDataURL(file);
  }

  protected async submit(): Promise<void> {
    this.saved.set(false);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    const err = await this.store.saveCompany({
      ...v,
      name: v.name.trim(),
      logo: this.logo(),
    });
    this.saving.set(false);
    this.saveError.set(err);
    this.saved.set(err === null);
  }
}