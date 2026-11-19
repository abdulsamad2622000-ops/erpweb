import { ChangeDetectionStrategy, Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { CrudDialogComponent } from '../../../shared/ui/crud-dialog/crud-dialog.component';
import { FormFieldComponent } from '../../../shared/ui/form-field/form-field.component';
import { PriceTier } from '../models/settings.models';
import { SettingsStore } from '../stores/settings.store';

@Component({
  selector: 'app-price-tiers-page',
  imports: [ReactiveFormsModule, TranslocoPipe, CrudDialogComponent, FormFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-4xl space-y-4">
      <h1 class="text-xl font-semibold">{{ 'settingsPage.priceTiers.title' | transloco }}</h1>
      <p class="text-sm text-slate-600 dark:text-slate-400">{{ 'settingsPage.priceTiers.hint' | transloco }}</p>

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
          <table class="w-full min-w-[30rem] text-start text-sm">
            <thead class="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400">
              <tr>
                <th scope="col" class="px-4 py-3 text-start font-medium">{{ 'settingsPage.priceTiers.code' | transloco }}</th>
                <th scope="col" class="px-4 py-3 text-start font-medium">{{ 'settingsPage.priceTiers.name' | transloco }}</th>
                <th scope="col" class="px-4 py-3 text-start font-medium">{{ 'settingsPage.priceTiers.active' | transloco }}</th>
                <th scope="col" class="px-4 py-3 text-end font-medium">{{ 'common.actions' | transloco }}</th>
              </tr>
            </thead>
            <tbody>
              @for (t of store.tiers(); track t.id) {
                <tr class="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td class="px-4 py-3">{{ 'settingsPage.priceTiers.codes.' + t.code | transloco }}</td>
                  <td class="px-4 py-3">{{ t.name }}</td>
                  <td class="px-4 py-3">
                    {{ (t.isActive ? 'common.status.active' : 'common.status.inactive') | transloco }}
                  </td>
                  <td class="px-4 py-2 text-end">
                    <button
                      type="button"
                      class="min-h-11 rounded-lg border border-slate-400 px-4 text-sm"
                      (click)="openForm(t)"
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
      [title]="'settingsPage.priceTiers.edit' | transloco"
      [saving]="saving()"
      (save)="submit()"
      (closed)="saving.set(false)"
    >
      <div [formGroup]="form" class="space-y-4">
        <app-form-field
          [label]="'settingsPage.priceTiers.name' | transloco"
          inputId="tier-name"
          [control]="form.controls.name"
          [required]="true"
        >
          <input
            id="tier-name"
            formControlName="name"
            class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm"
          />
        </app-form-field>
        <label class="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" formControlName="isActive" class="size-5" />
          {{ 'settingsPage.priceTiers.active' | transloco }}
        </label>
        @if (retailLocked()) {
          <p class="text-xs text-slate-600 dark:text-slate-400">{{ 'settingsPage.priceTiers.retailLocked' | transloco }}</p>
        }
      </div>
    </app-crud-dialog>
  `,
})
export class PriceTiersPage implements OnInit {
  protected readonly store = inject(SettingsStore);
  private readonly fb = inject(FormBuilder);
  private readonly i18n = inject(TranslocoService);

  private readonly dlg = viewChild.required(CrudDialogComponent);

  protected readonly loaded = signal(false);
  protected readonly loadError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly editingId = signal<number | null>(null);
  protected readonly retailLocked = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(50)]],
    isActive: [true],
  });

  ngOnInit(): void {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loadError.set(null);
    try {
      await this.store.loadTiers();
      this.loaded.set(true);
    } catch {
      this.loadError.set(this.i18n.translate('errors.generic'));
    }
  }

  protected openForm(row: PriceTier): void {
    this.editingId.set(row.id);
    this.form.reset({ name: row.name, isActive: row.isActive });
    const locked = row.code === 'retail';
    this.retailLocked.set(locked);
    if (locked) this.form.controls.isActive.disable();
    else this.form.controls.isActive.enable();
    this.dlg().open();
  }

  protected async submit(): Promise<void> {
    const id = this.editingId();
    if (id === null) return;
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    const err = await this.store.saveTier(id, { name: v.name.trim(), isActive: v.isActive });
    this.saving.set(false);
    if (err) {
      this.form.controls.name.setErrors({ server: err });
      return;
    }
    this.dlg().close();
  }
}