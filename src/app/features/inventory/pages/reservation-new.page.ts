import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { FormFieldComponent } from '../../../shared/ui/form-field/form-field.component';
import { UI, errorMessage } from '../../purchase/utils/ui';
import { parseSerialList } from '../../purchase/utils/purchase-utils';
import { ReservationsService } from '../services/reservations.service';
import { todayIso } from '../utils/reservation-utils';

@Component({
  selector: 'app-reservation-new-page',
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe, FormFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-3xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">{{ 'reservationsPage.newTitle' | transloco }}</h1>
        <a routerLink="/inventory/reservations" [class]="ui.btn">{{ 'reservationsPage.back' | transloco }}</a>
      </div>

      <form [formGroup]="form" (ngSubmit)="submit()" [class]="ui.card + ' space-y-4'">
        <app-form-field
          [label]="'reservationsPage.customer' | transloco"
          inputId="res-customer"
          [control]="form.controls.customerName"
          [required]="true"
        >
          <input id="res-customer" formControlName="customerName" [class]="ui.input" />
        </app-form-field>

        <app-form-field
          [label]="'reservationsPage.holdUntil' | transloco"
          inputId="res-hold"
          [control]="form.controls.holdUntil"
        >
          <input id="res-hold" type="date" [min]="today" formControlName="holdUntil" [class]="ui.input" />
        </app-form-field>
        <p class="-mt-2 text-xs text-slate-600 dark:text-slate-400">{{ 'reservationsPage.holdHint' | transloco }}</p>

        <app-form-field
          [label]="'reservationsPage.note' | transloco"
          inputId="res-note"
          [control]="form.controls.note"
        >
          <textarea id="res-note" rows="2" formControlName="note" [class]="ui.input + ' py-2'"></textarea>
        </app-form-field>

        <div class="space-y-2">
          <label for="res-serial" class="block text-sm font-medium">{{ 'reservationsPage.serialInput' | transloco }}</label>
          <div class="flex flex-wrap gap-2">
            <input
              #box
              id="res-serial"
              dir="ltr"
              autocomplete="off"
              [class]="ui.input + ' max-w-sm flex-1'"
              (keydown.enter)="onEnter($event, box)"
            />
            <button type="button" [class]="ui.btn" (click)="addFrom(box)">{{ 'reservationsPage.serialAdd' | transloco }}</button>
          </div>
          <p class="text-xs text-slate-600 dark:text-slate-400">{{ 'reservationsPage.serialHint' | transloco }}</p>
          @if (serials().length) {
            <ul class="flex flex-wrap gap-2" [attr.aria-label]="'reservationsPage.serials' | transloco">
              @for (s of serials(); track s) {
                <li class="inline-flex items-center gap-1 rounded-lg border border-slate-300 ps-3 dark:border-slate-600">
                  <code dir="ltr" class="text-sm">{{ s }}</code>
                  <button
                    type="button"
                    class="inline-flex min-h-11 min-w-11 items-center justify-center"
                    [attr.aria-label]="('reservationsPage.remove' | transloco) + ' ' + s"
                    (click)="remove(s)"
                  >
                    <i class="pi pi-times" aria-hidden="true"></i>
                  </button>
                </li>
              }
            </ul>
          }
        </div>

        @if (error(); as e) {
          <p role="alert" class="rounded-lg border border-red-600 p-3 text-sm text-red-600">{{ e }}</p>
        }

        <div class="flex justify-end gap-2">
          <a routerLink="/inventory/reservations" [class]="ui.btn">{{ 'common.cancel' | transloco }}</a>
          <button type="submit" [class]="ui.primary" [disabled]="saving()">{{ 'reservationsPage.save' | transloco }}</button>
        </div>
      </form>
    </section>
  `,
})
export class ReservationNewPage {
  private readonly api = inject(ReservationsService);
  private readonly router = inject(Router);
  private readonly i18n = inject(TranslocoService);
  private readonly fb = inject(FormBuilder);
  protected readonly ui = UI;
  protected readonly today = todayIso();

  protected readonly serials = signal<string[]>([]);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    customerName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    holdUntil: [''],
    note: ['', [Validators.maxLength(300)]],
  });

  protected onEnter(e: Event, box: HTMLInputElement): void {
    e.preventDefault();
    this.addFrom(box);
  }

  /** Ek serial ya paste ki hui list (line, comma, tab) dono chalti hain. */
  protected addFrom(box: HTMLInputElement): void {
    const found = parseSerialList(box.value);
    if (found.length) {
      this.serials.update((cur) => [...cur, ...found.filter((s) => !cur.includes(s))]);
    }
    box.value = '';
    box.focus();
  }

  protected remove(serial: string): void {
    this.serials.update((cur) => cur.filter((s) => s !== serial));
  }

  protected async submit(): Promise<void> {
    this.error.set(null);
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    if (!this.serials().length) {
      this.error.set(this.i18n.translate('reservationsPage.needSerial'));
      return;
    }
    this.saving.set(true);
    const v = this.form.getRawValue();
    try {
      await firstValueFrom(
        this.api.create({
          customerName: v.customerName.trim(),
          note: v.note.trim() || null,
          holdUntil: v.holdUntil || null,
          serials: this.serials(),
        }),
      );
      await this.router.navigateByUrl('/inventory/reservations');
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('errors.generic')));
    } finally {
      this.saving.set(false);
    }
  }
}