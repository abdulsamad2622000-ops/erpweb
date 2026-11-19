import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CostingMethod, NegativeStockRule } from '../models/settings.models';
import { SettingsStore } from '../stores/settings.store';

@Component({
  selector: 'app-costing-page',
  imports: [ReactiveFormsModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-3xl space-y-4">
      <h1 class="text-xl font-semibold">{{ 'settingsPage.costing.title' | transloco }}</h1>

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
          <div class="h-16 rounded-lg bg-slate-200 dark:bg-slate-700"></div>
          <div class="h-16 rounded-lg bg-slate-200 dark:bg-slate-700"></div>
          <div class="h-16 rounded-lg bg-slate-200 dark:bg-slate-700"></div>
        </div>
      } @else {
        <form
          [formGroup]="form"
          (ngSubmit)="submit()"
          class="space-y-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-900"
        >
          <fieldset class="space-y-2">
            <legend class="mb-1 text-sm font-medium">{{ 'settingsPage.costing.method' | transloco }}</legend>
            @for (m of methods; track m) {
              <label
                class="flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border border-slate-300 p-3 dark:border-slate-600"
              >
                <input type="radio" formControlName="method" [value]="m" class="mt-1 size-5" />
                <span>
                  <span class="block text-sm font-medium">{{ 'settingsPage.costing.methods.' + m | transloco }}</span>
                  <span class="block text-xs text-slate-600 dark:text-slate-400">
                    {{ 'settingsPage.costing.methods.' + m + 'Hint' | transloco }}
                  </span>
                </span>
              </label>
            }
          </fieldset>

          <fieldset class="space-y-2">
            <legend class="mb-1 text-sm font-medium">{{ 'settingsPage.costing.negativeStock' | transloco }}</legend>
            @for (r of rules; track r) {
              <label
                class="flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border border-slate-300 p-3 dark:border-slate-600"
              >
                <input type="radio" formControlName="negativeStock" [value]="r" class="mt-1 size-5" />
                <span>
                  <span class="block text-sm font-medium">{{ 'settingsPage.costing.rules.' + r | transloco }}</span>
                  <span class="block text-xs text-slate-600 dark:text-slate-400">
                    {{ 'settingsPage.costing.rules.' + r + 'Hint' | transloco }}
                  </span>
                </span>
              </label>
            }
          </fieldset>

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
export class CostingPage implements OnInit {
  protected readonly store = inject(SettingsStore);
  private readonly fb = inject(FormBuilder);
  private readonly i18n = inject(TranslocoService);

  protected readonly methods: CostingMethod[] = ['fifo', 'weighted_average', 'serial_specific'];
  protected readonly rules: NegativeStockRule[] = ['block', 'warn', 'allow'];

  protected readonly loaded = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    method: ['fifo' as CostingMethod],
    negativeStock: ['block' as NegativeStockRule],
  });

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loadError.set(null);
    try {
      await this.store.loadCosting();
      const c = this.store.costing();
      if (c) this.form.reset({ method: c.method, negativeStock: c.negativeStock });
      this.loaded.set(true);
    } catch {
      this.loadError.set(this.i18n.translate('errors.generic'));
    }
  }

  protected async submit(): Promise<void> {
    this.saved.set(false);
    this.saving.set(true);
    const err = await this.store.saveCosting(this.form.getRawValue());
    this.saving.set(false);
    this.saveError.set(err);
    this.saved.set(err === null);
  }
}