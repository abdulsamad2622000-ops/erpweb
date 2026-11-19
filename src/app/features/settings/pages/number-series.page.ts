import { ChangeDetectionStrategy, Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CrudDialogComponent } from '../../../shared/ui/crud-dialog/crud-dialog.component';
import { FormFieldComponent } from '../../../shared/ui/form-field/form-field.component';
import { NumberSeries, formatSeries } from '../models/settings.models';
import { SettingsStore } from '../stores/settings.store';

@Component({
  selector: 'app-number-series-page',
  imports: [ReactiveFormsModule, TranslocoPipe, CrudDialogComponent, FormFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-4xl space-y-4">
      <h1 class="text-xl font-semibold">{{ 'settingsPage.numberSeries.title' | transloco }}</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">{{ 'settingsPage.numberSeries.hint' | transloco }}</p>

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
          <div class="h-12 rounded-lg bg-slate-200 dark:bg-slate-700"></div>
          <div class="h-12 rounded-lg bg-slate-200 dark:bg-slate-700"></div>
          <div class="h-12 rounded-lg bg-slate-200 dark:bg-slate-700"></div>
        </div>
      } @else {
        <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <table class="w-full min-w-[34rem] text-start text-sm">
            <thead class="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400">
              <tr>
                <th scope="col" class="px-4 py-3 text-start font-medium">{{ 'settingsPage.numberSeries.document' | transloco }}</th>
                <th scope="col" class="px-4 py-3 text-start font-medium">{{ 'settingsPage.numberSeries.prefix' | transloco }}</th>
                <th scope="col" class="px-4 py-3 text-start font-medium">{{ 'settingsPage.numberSeries.next' | transloco }}</th>
                <th scope="col" class="px-4 py-3 text-start font-medium">{{ 'settingsPage.numberSeries.example' | transloco }}</th>
                <th scope="col" class="px-4 py-3 text-end font-medium">{{ 'common.actions' | transloco }}</th>
              </tr>
            </thead>
            <tbody>
              @for (s of store.series(); track s.id) {
                <tr class="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td class="px-4 py-3">{{ 'settingsPage.numberSeries.code.' + s.code | transloco }}</td>
                  <td class="px-4 py-3" dir="ltr">{{ s.prefix }}</td>
                  <td class="px-4 py-3">{{ s.nextNumber }}</td>
                  <td class="px-4 py-3" dir="ltr">{{ example(s) }}</td>
                  <td class="px-4 py-2 text-end">
                    <button
                      type="button"
                      class="min-h-11 rounded-lg border border-slate-400 px-4 text-sm"
                      (click)="openForm(s)"
                    >
                      {{ 'common.edit' | transloco }}
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>

    <app-crud-dialog
      [title]="'settingsPage.numberSeries.edit' | transloco"
      [saving]="saving()"
      (save)="submit()"
      (closed)="saving.set(false)"
    >
      <div [formGroup]="form" class="space-y-4">
        <app-form-field
          [label]="'settingsPage.numberSeries.prefix' | transloco"
          inputId="series-prefix"
          [control]="form.controls.prefix"
          [required]="true"
        >
          <input
            id="series-prefix"
            dir="ltr"
            formControlName="prefix"
            class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm"
          />
        </app-form-field>
        <app-form-field
          [label]="'settingsPage.numberSeries.next' | transloco"
          inputId="series-next"
          [control]="form.controls.nextNumber"
          [required]="true"
        >
          <input
            id="series-next"
            type="number"
            inputmode="numeric"
            min="1"
            formControlName="nextNumber"
            class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm"
          />
        </app-form-field>
        <app-form-field
          [label]="'settingsPage.numberSeries.padding' | transloco"
          inputId="series-padding"
          [control]="form.controls.padding"
          [required]="true"
        >
          <input
            id="series-padding"
            type="number"
            inputmode="numeric"
            min="3"
            max="10"
            formControlName="padding"
            class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm"
          />
        </app-form-field>
        <label class="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" formControlName="resetYearly" class="size-5" />
          {{ 'settingsPage.numberSeries.resetYearly' | transloco }}
        </label>
      </div>
    </app-crud-dialog>
  `,
})
export class NumberSeriesPage implements OnInit {
  protected readonly store = inject(SettingsStore);
  private readonly fb = inject(FormBuilder);
  private readonly i18n = inject(TranslocoService);

  private readonly dlg = viewChild.required(CrudDialogComponent);

  protected readonly example = formatSeries;
  protected readonly loaded = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly editingId = signal<number | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    prefix: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9\-_/]{1,12}$/)]],
    nextNumber: [1, [Validators.required, Validators.min(1)]],
    padding: [6, [Validators.required, Validators.min(3), Validators.max(10)]],
    resetYearly: [false],
  });

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loadError.set(null);
    try {
      await this.store.loadSeries();
      this.loaded.set(true);
    } catch {
      this.loadError.set(this.i18n.translate('errors.generic'));
    }
  }

  protected openForm(row: NumberSeries): void {
    this.editingId.set(row.id);
    this.form.reset({
      prefix: row.prefix,
      nextNumber: row.nextNumber,
      padding: row.padding,
      resetYearly: row.resetYearly,
    });
    this.dlg().open();
  }

  protected async submit(): Promise<void> {
    const id = this.editingId();
    if (id === null) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    const err = await this.store.saveSeries(id, {
      prefix: v.prefix.trim(),
      nextNumber: v.nextNumber,
      padding: v.padding,
      resetYearly: v.resetYearly,
    });
    this.saving.set(false);
    if (err) {
      this.form.controls.prefix.setErrors({ server: err });
      return;
    }
    this.dlg().close();
  }
}