import { ChangeDetectionStrategy, Component, OnInit, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { HasPermissionDirective } from '../../../core/auth/has-permission.directive';
import { CrudDialogComponent } from '../../../shared/ui/crud-dialog/crud-dialog.component';
import { FormFieldComponent } from '../../../shared/ui/form-field/form-field.component';
import { Supplier } from '../models/purchase.models';
import { PurchaseService } from '../services/purchase.service';
import { UI, errorMessage } from '../utils/ui';

@Component({
  selector: 'app-suppliers-page',
  imports: [FormsModule, ReactiveFormsModule, RouterLink, TranslocoPipe, CrudDialogComponent, FormFieldComponent, HasPermissionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">{{ 'purchase.suppliers.title' | transloco }}</h1>
        <button *hasPermission="'purchase.supplier.create'" type="button" [class]="ui.primary" (click)="open(null)">
          + {{ 'purchase.suppliers.add' | transloco }}
        </button>
      </div>
      <input [class]="ui.input + ' max-w-sm'" [attr.aria-label]="'common.search' | transloco"
             [placeholder]="'common.search' | transloco" [ngModel]="q()" (ngModelChange)="q.set($event); load()" />
      @if (error(); as e) { <p role="alert" class="text-sm text-red-600">{{ e }}</p> }
      <div [class]="ui.tableWrap">
        <table class="w-full min-w-[44rem] text-start text-sm">
          <thead [class]="ui.thead"><tr>
            <th scope="col" [class]="ui.th">{{ 'common.name' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'purchase.suppliers.phone' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'purchase.suppliers.city' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'purchase.suppliers.terms' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'purchase.statusCol' | transloco }}</th>
            <th scope="col" [class]="ui.th + ' text-end'">{{ 'common.actions' | transloco }}</th>
          </tr></thead>
          <tbody>
            @for (s of rows(); track s.id) {
              <tr [class]="ui.tr">
                <td [class]="ui.td + ' font-medium'">{{ s.name }}</td>
                <td [class]="ui.td" dir="ltr">{{ s.phone }}</td>
                <td [class]="ui.td">{{ s.city }}</td>
                <td [class]="ui.td">{{ 'purchase.suppliers.days' | transloco: { n: s.paymentTermsDays } }}</td>
                <td [class]="ui.td">{{ (s.isActive ? 'common.status.active' : 'common.status.inactive') | transloco }}</td>
                <td [class]="ui.td + ' text-end'">
                  <a [routerLink]="[s.id, 'ledger']" [class]="ui.btn + ' me-2'">{{ 'purchase.payables.ledger' | transloco }}</a>
                  <button *hasPermission="'purchase.supplier.edit'" type="button" [class]="ui.btn" (click)="open(s)">{{ 'common.edit' | transloco }}</button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="px-4 py-6 text-center text-slate-500">{{ 'common.empty' | transloco }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>

    <app-crud-dialog [title]="(editingId() ? 'purchase.suppliers.edit' : 'purchase.suppliers.add') | transloco"
                     [saving]="saving()" (save)="submit()" (closed)="saving.set(false)">
      <div [formGroup]="form" class="grid gap-4 sm:grid-cols-2">
        <app-form-field class="sm:col-span-2" [label]="'common.name' | transloco" inputId="sup-name" [control]="form.controls.name" [required]="true">
          <input id="sup-name" formControlName="name" [class]="ui.input" />
        </app-form-field>
        <app-form-field [label]="'purchase.suppliers.phone' | transloco" inputId="sup-phone" [control]="form.controls.phone">
          <input id="sup-phone" formControlName="phone" dir="ltr" [class]="ui.input" />
        </app-form-field>
        <app-form-field [label]="'purchase.suppliers.email' | transloco" inputId="sup-email" [control]="form.controls.email">
          <input id="sup-email" type="email" formControlName="email" dir="ltr" [class]="ui.input" />
        </app-form-field>
        <app-form-field [label]="'purchase.suppliers.city' | transloco" inputId="sup-city" [control]="form.controls.city">
          <input id="sup-city" formControlName="city" [class]="ui.input" />
        </app-form-field>
        <app-form-field [label]="'purchase.suppliers.taxNumber' | transloco" inputId="sup-tax" [control]="form.controls.taxNumber">
          <input id="sup-tax" formControlName="taxNumber" dir="ltr" [class]="ui.input" />
        </app-form-field>
        <app-form-field [label]="'purchase.suppliers.termsDays' | transloco" inputId="sup-terms" [control]="form.controls.paymentTermsDays">
          <input id="sup-terms" type="number" min="0" formControlName="paymentTermsDays" [class]="ui.input" />
        </app-form-field>
        <label class="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" formControlName="isActive" class="size-5" /> {{ 'common.status.active' | transloco }}
        </label>
        @if (formError(); as e) { <p role="alert" class="text-sm text-red-600 sm:col-span-2">{{ e }}</p> }
      </div>
    </app-crud-dialog>
  `,
})
export class SuppliersPage implements OnInit {
  private readonly api = inject(PurchaseService);
  private readonly fb = inject(FormBuilder);
  private readonly i18n = inject(TranslocoService);
  private readonly dlg = viewChild.required(CrudDialogComponent);
  protected readonly ui = UI;

  protected readonly rows = signal<Supplier[]>([]);
  protected readonly q = signal('');
  protected readonly error = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly saving = signal(false);
  protected readonly editingId = signal<number | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(120)]],
    phone: ['', Validators.maxLength(30)],
    email: ['', [Validators.email, Validators.maxLength(120)]],
    city: ['', Validators.maxLength(60)],
    taxNumber: ['', Validators.maxLength(30)],
    paymentTermsDays: [30, [Validators.required, Validators.min(0), Validators.max(365)]],
    isActive: [true],
  });

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    try {
      this.rows.set((await firstValueFrom(this.api.suppliers(this.q()))).data);
      this.error.set(null);
    } catch {
      this.error.set(this.i18n.translate('errors.generic'));
    }
  }

  protected open(s: Supplier | null): void {
    this.editingId.set(s?.id ?? null);
    this.formError.set(null);
    this.form.reset(s ?? { name: '', phone: '', email: '', city: '', taxNumber: '', paymentTermsDays: 30, isActive: true });
    this.dlg().open();
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.saving.set(true);
    const v = this.form.getRawValue();
    const body = { ...v, name: v.name.trim(), paymentTermsDays: +v.paymentTermsDays };
    try {
      const id = this.editingId();
      await firstValueFrom(id ? this.api.updateSupplier(id, body) : this.api.createSupplier(body));
      this.dlg().close();
      await this.load();
    } catch (e) {
      this.formError.set(errorMessage(e, this.i18n.translate('errors.generic')));
    } finally {
      this.saving.set(false);
    }
  }
}
