import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal, viewChild } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { HasPermissionDirective } from '../../../core/auth/has-permission.directive';
import { CrudDialogComponent } from '../../../shared/ui/crud-dialog/crud-dialog.component';
import { FormFieldComponent } from '../../../shared/ui/form-field/form-field.component';
import { formatMoney } from '../../products/utils/product-utils';
import { PaymentMethod, SupplierPayment } from '../models/payables.models';
import { Supplier } from '../models/purchase.models';
import { PayablesService } from '../services/payables.service';
import { PurchaseService } from '../services/purchase.service';
import { outstanding, paymentAmountError } from '../utils/payables-utils';
import { UI, errorMessage } from '../utils/ui';

@Component({
  selector: 'app-supplier-payments-page',
  imports: [FormsModule, ReactiveFormsModule, TranslocoPipe, CrudDialogComponent, FormFieldComponent, HasPermissionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">{{ 'purchase.payables.paymentsTitle' | transloco }}</h1>
        <button *hasPermission="'purchase.payment.create'" type="button" [class]="ui.primary" (click)="open()">
          + {{ 'purchase.payables.newPayment' | transloco }}
        </button>
      </div>

      <div class="max-w-sm">
        <label for="pay-filter" class="mb-1 block text-sm">{{ 'purchase.orders.supplier' | transloco }}</label>
        <select id="pay-filter" [class]="ui.input" [ngModel]="filter()" (ngModelChange)="setFilter(+$event)">
          <option [ngValue]="0">{{ 'purchase.payables.allSuppliers' | transloco }}</option>
          @for (s of suppliers(); track s.id) { <option [ngValue]="s.id">{{ s.name }}</option> }
        </select>
      </div>

      @if (notice(); as n) { <p role="status" class="rounded-lg border border-green-600 p-3 text-sm text-green-700">{{ n }}</p> }
      @if (error(); as e) {
        <div role="alert" class="space-y-2 rounded-lg border border-red-600 p-3">
          <p class="text-sm text-red-600">{{ e }}</p>
          <button type="button" [class]="ui.btn" (click)="load()">{{ 'common.retry' | transloco }}</button>
        </div>
      }

      <div [class]="ui.tableWrap">
        <table class="w-full min-w-[44rem] text-start text-sm">
          <thead [class]="ui.thead"><tr>
            <th scope="col" [class]="ui.th">{{ 'purchase.payables.date' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'purchase.orders.supplier' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'purchase.payables.method' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'purchase.payables.reference' | transloco }}</th>
            <th scope="col" [class]="ui.th + ' text-end'">{{ 'purchase.payables.amount' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'purchase.payables.createdBy' | transloco }}</th>
          </tr></thead>
          <tbody>
            @if (loading()) {
              <tr><td colspan="6" class="px-4 py-6 text-center text-slate-500" role="status">{{ 'common.loading' | transloco }}</td></tr>
            } @else {
              @for (p of rows(); track p.id) {
                <tr [class]="ui.tr">
                  <td [class]="ui.td">{{ p.date }}</td>
                  <td [class]="ui.td">{{ nameOf(p.supplierId) }}</td>
                  <td [class]="ui.td">{{ 'purchase.payables.methods.' + p.method | transloco }}</td>
                  <td [class]="ui.td">{{ p.reference || '-' }}</td>
                  <td [class]="ui.td + ' text-end font-medium'">{{ money(p.amount) }}</td>
                  <td [class]="ui.td">{{ p.createdBy }}</td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="px-4 py-6 text-center text-slate-500">{{ 'common.empty' | transloco }}</td></tr>
              }
            }
          </tbody>
        </table>
      </div>
    </section>

    <app-crud-dialog [title]="'purchase.payables.newPayment' | transloco" [saving]="saving()" (save)="submit()" (closed)="saving.set(false)">
      <div [formGroup]="form" class="grid gap-4 sm:grid-cols-2">
        <app-form-field class="sm:col-span-2" [label]="'purchase.orders.supplier' | transloco" inputId="pay-sup" [control]="form.controls.supplierId" [required]="true">
          <select id="pay-sup" formControlName="supplierId" [class]="ui.input" (change)="loadOwed()">
            <option [ngValue]="0" disabled>{{ 'purchase.payables.pickSupplier' | transloco }}</option>
            @for (s of suppliers(); track s.id) { <option [ngValue]="s.id">{{ s.name }}</option> }
          </select>
        </app-form-field>
        @if (form.controls.supplierId.value > 0) {
          <p class="text-sm sm:col-span-2" aria-live="polite">
            {{ 'purchase.payables.owedNow' | transloco }}: <strong>Rs {{ money(owed()) }}</strong>
          </p>
        }
        <app-form-field [label]="'purchase.payables.date' | transloco" inputId="pay-date" [control]="form.controls.date" [required]="true">
          <input id="pay-date" type="date" formControlName="date" [class]="ui.input" />
        </app-form-field>
        <app-form-field [label]="'purchase.payables.amount' | transloco" inputId="pay-amount" [control]="form.controls.amount" [required]="true">
          <input id="pay-amount" type="number" min="0" step="0.01" formControlName="amount" [class]="ui.input" />
        </app-form-field>
        <app-form-field [label]="'purchase.payables.method' | transloco" inputId="pay-method" [control]="form.controls.method">
          <select id="pay-method" formControlName="method" [class]="ui.input">
            @for (m of methods; track m) { <option [value]="m">{{ 'purchase.payables.methods.' + m | transloco }}</option> }
          </select>
        </app-form-field>
        <app-form-field [label]="'purchase.payables.reference' | transloco" inputId="pay-ref" [control]="form.controls.reference">
          <input id="pay-ref" formControlName="reference" dir="ltr" [class]="ui.input" />
        </app-form-field>
        <app-form-field class="sm:col-span-2" [label]="'purchase.grn.note' | transloco" inputId="pay-note" [control]="form.controls.note">
          <input id="pay-note" formControlName="note" [class]="ui.input" />
        </app-form-field>
        @if (formError(); as e) { <p role="alert" class="text-sm text-red-600 sm:col-span-2">{{ e }}</p> }
      </div>
    </app-crud-dialog>
  `,
})
export class SupplierPaymentsPage implements OnInit {
  private readonly api = inject(PurchaseService);
  private readonly pay = inject(PayablesService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(TranslocoService);
  private readonly dlg = viewChild.required(CrudDialogComponent);
  protected readonly ui = UI;
  protected readonly money = formatMoney;
  protected readonly methods: PaymentMethod[] = ['cash', 'bank_transfer', 'cheque'];

  protected readonly suppliers = signal<Supplier[]>([]);
  protected readonly rows = signal<SupplierPayment[]>([]);
  protected readonly filter = signal(0);
  protected readonly owed = signal(0);
  protected readonly loading = signal(true);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  private readonly names = computed(() => new Map(this.suppliers().map((s) => [s.id, s.name] as [number, string])));

  protected readonly form = this.fb.nonNullable.group({
    supplierId: [0, Validators.min(1)],
    date: [new Date().toISOString().slice(0, 10), Validators.required],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    method: ['cash' as PaymentMethod, Validators.required],
    reference: ['', Validators.maxLength(60)],
    note: ['', Validators.maxLength(200)],
  });

  ngOnInit(): void {
    const sid = Number(this.route.snapshot.queryParamMap.get('supplierId'));
    if (sid > 0) this.filter.set(sid);
    void this.init();
  }

  protected nameOf(id: number): string {
    return this.names().get(id) ?? '-';
  }

  private async init(): Promise<void> {
    try {
      this.suppliers.set((await firstValueFrom(this.api.suppliers())).data);
    } catch {
      this.error.set(this.i18n.translate('errors.generic'));
    }
    await this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      this.rows.set(await firstValueFrom(this.pay.payments(this.filter() || null)));
    } catch {
      this.error.set(this.i18n.translate('errors.generic'));
    } finally {
      this.loading.set(false);
    }
  }

  protected setFilter(id: number): void {
    this.filter.set(id);
    void this.load();
  }

  protected open(): void {
    this.formError.set(null);
    this.owed.set(0);
    this.form.reset({ supplierId: this.filter(), date: new Date().toISOString().slice(0, 10), amount: 0, method: 'cash', reference: '', note: '' });
    if (this.filter() > 0) void this.loadOwed();
    this.dlg().open();
  }

  protected async loadOwed(): Promise<void> {
    const id = this.form.controls.supplierId.value;
    if (id < 1) return;
    try {
      this.owed.set(outstanding((await firstValueFrom(this.pay.ledger(id))).entries));
    } catch {
      this.owed.set(0);
    }
  }

  protected async submit(): Promise<void> {
    this.form.markAllAsTouched();
    this.formError.set(null);
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    const bad = paymentAmountError(+v.amount, this.owed());
    if (bad) {
      this.formError.set(this.i18n.translate(bad === 'too_much' ? 'purchase.payables.amountTooMuch' : 'purchase.payables.amountInvalid'));
      return;
    }
    this.saving.set(true);
    try {
      await firstValueFrom(this.pay.createPayment({
        supplierId: v.supplierId, date: v.date, amount: +v.amount, method: v.method,
        reference: v.reference.trim(), note: v.note.trim() || null,
      }));
      this.dlg().close();
      this.notice.set(this.i18n.translate('purchase.payables.saved'));
      await this.load();
    } catch (e) {
      this.formError.set(errorMessage(e, this.i18n.translate('errors.generic')));
    } finally {
      this.saving.set(false);
    }
  }
}