import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { HasPermissionDirective } from '../../../core/auth/has-permission.directive';
import { money } from '../../pos/utils/pos-utils';
import { UI, errorMessage } from '../../purchase/utils/ui';
import { CustomerForm, WholesaleCustomer } from '../models/sales.models';
import { SalesService } from '../services/sales.service';

const EMPTY: CustomerForm = {
  name: '', phone: '', email: '', type: 'wholesale', priceTier: 'wholesale', creditLimit: 0, paymentTermsDays: 0,
  address: '', city: '', isActive: true,
};

/** Customers: list, naya/edit, credit limit, payment terms, udhaar baqi. */
@Component({
  selector: 'app-customers-page',
  imports: [FormsModule, RouterLink, TranslocoPipe, HasPermissionDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">{{ 'customersPage.title' | transloco }}</h1>
        <div class="flex flex-wrap gap-2">
          <a routerLink="/customers/aging" [class]="ui.btn">{{ 'agingPage.title' | transloco }}</a>
          <button *hasPermission="'customers.customer.create'" type="button" [class]="ui.primary" (click)="openNew()">
            + {{ 'customersPage.add' | transloco }}
          </button>
        </div>
      </div>
      <div class="flex flex-wrap gap-2">
        <input #q [class]="ui.input + ' max-w-xs'" [attr.aria-label]="'common.search' | transloco"
          [placeholder]="'customersPage.search' | transloco" (input)="search(q.value)" />
        <select [class]="ui.input + ' max-w-48'" [attr.aria-label]="'customersPage.type' | transloco" [(ngModel)]="type" (ngModelChange)="load()">
          <option value="">{{ 'customersPage.allTypes' | transloco }}</option>
          @for (t of types; track t) { <option [value]="t">{{ 'customersPage.types.' + t | transloco }}</option> }
        </select>
      </div>
      @if (error(); as e) { <p role="alert" class="text-sm text-red-600">{{ e }}</p> }
      <div [class]="ui.tableWrap">
        <table class="w-full min-w-[48rem] text-sm">
          <thead [class]="ui.thead"><tr>
            <th scope="col" [class]="ui.th">{{ 'customersPage.name' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'customersPage.phone' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'customersPage.type' | transloco }}</th>
            <th scope="col" [class]="ui.th + ' text-end'">{{ 'customersPage.creditLimit' | transloco }}</th>
            <th scope="col" [class]="ui.th + ' text-end'">{{ 'customersPage.balance' | transloco }}</th>
            <th scope="col" [class]="ui.th"><span class="sr-only">{{ 'common.actions' | transloco }}</span></th>
          </tr></thead>
          <tbody>
            @for (c of rows(); track c.id) {
              <tr [class]="ui.tr" [class.opacity-60]="!c.isActive">
                <td [class]="ui.td"><div class="font-medium">{{ c.name }}</div><div class="text-xs text-slate-600 dark:text-slate-400">{{ c.city }}</div></td>
                <td [class]="ui.td" dir="ltr">{{ c.phone }}</td>
                <td [class]="ui.td">{{ 'customersPage.types.' + c.type | transloco }}</td>
                <td [class]="ui.td + ' text-end'">{{ c.creditLimit ? fmt(c.creditLimit) : ('customersPage.cashOnly' | transloco) }}</td>
                <td [class]="ui.td + ' text-end font-medium'" [class.text-red-600]="c.balance > 0">{{ fmt(c.balance) }}</td>
                <td [class]="ui.td + ' whitespace-nowrap text-end'">
                  <a [routerLink]="['/customers', c.id, 'ledger']" [class]="ui.btn">{{ 'ledgerPage.title' | transloco }}</a>
                  <a [routerLink]="['/sales/invoices']" [queryParams]="{ customerId: c.id }" [class]="ui.btn + ' ms-1'">{{ 'customersPage.bills' | transloco }}</a>
                  <button *hasPermission="'customers.customer.edit'" type="button" [class]="ui.btn + ' ms-1'" (click)="edit(c)">
                    {{ 'common.edit' | transloco }}
                  </button>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="px-4 py-6 text-center text-slate-500">{{ 'common.empty' | transloco }}</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>

    @if (form(); as f) {
      <div class="fixed inset-0 z-40 flex items-start justify-center overflow-auto bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="cf-t">
        <div [class]="ui.card + ' grid w-full max-w-xl gap-3 sm:grid-cols-2'">
          <h2 id="cf-t" class="font-semibold sm:col-span-2">{{ (editId ? 'customersPage.editTitle' : 'customersPage.add') | transloco }}</h2>
          <label class="text-sm font-medium">{{ 'customersPage.name' | transloco }}
            <input [class]="ui.input + ' mt-1'" [(ngModel)]="f.name" /></label>
          <label class="text-sm font-medium">{{ 'customersPage.phone' | transloco }}
            <input type="tel" dir="ltr" [class]="ui.input + ' mt-1'" [(ngModel)]="f.phone" /></label>
          <label class="text-sm font-medium">{{ 'customersPage.type' | transloco }}
            <select [class]="ui.input + ' mt-1'" [(ngModel)]="f.type" (ngModelChange)="f.priceTier = $event">
              @for (t of types; track t) { <option [value]="t">{{ 'customersPage.types.' + t | transloco }}</option> }
            </select></label>
          <label class="text-sm font-medium">{{ 'customersPage.priceTier' | transloco }}
            <select [class]="ui.input + ' mt-1'" [(ngModel)]="f.priceTier">
              @for (t of types; track t) { <option [value]="t">{{ 'customersPage.types.' + t | transloco }}</option> }
            </select></label>
          <label class="text-sm font-medium">{{ 'customersPage.creditLimit' | transloco }}
            <input type="number" min="0" [class]="ui.input + ' mt-1'" [(ngModel)]="f.creditLimit" />
            <span class="text-xs font-normal text-slate-600 dark:text-slate-400">{{ 'customersPage.creditHint' | transloco }}</span></label>
          <label class="text-sm font-medium">{{ 'customersPage.terms' | transloco }}
            <input type="number" min="0" max="365" [class]="ui.input + ' mt-1'" [(ngModel)]="f.paymentTermsDays" /></label>
          <label class="text-sm font-medium">{{ 'customersPage.email' | transloco }}
            <input type="email" dir="ltr" [class]="ui.input + ' mt-1'" [(ngModel)]="f.email" /></label>
          <label class="text-sm font-medium">{{ 'customersPage.city' | transloco }}
            <input [class]="ui.input + ' mt-1'" [(ngModel)]="f.city" /></label>
          <label class="text-sm font-medium sm:col-span-2">{{ 'customersPage.address' | transloco }}
            <input [class]="ui.input + ' mt-1'" [(ngModel)]="f.address" /></label>
          @if (editId) {
            <label class="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" class="h-5 w-5" [(ngModel)]="f.isActive" /> {{ 'customersPage.active' | transloco }}</label>
          }
          @if (formError(); as e) { <p role="alert" class="text-sm text-red-600 sm:col-span-2">{{ e }}</p> }
          <div class="flex justify-end gap-2 sm:col-span-2">
            <button type="button" [class]="ui.btn" (click)="form.set(null)">{{ 'common.cancel' | transloco }}</button>
            <button type="button" [class]="ui.primary" [disabled]="busy()" (click)="save(f)">{{ 'common.save' | transloco }}</button>
          </div>
        </div>
      </div>
    }
  `,
})
export class CustomersPage implements OnInit {
  private readonly api = inject(SalesService);
  private readonly i18n = inject(TranslocoService);
  protected readonly ui = UI;
  protected readonly types = ['retail', 'wholesale', 'dealer'] as const;
  protected readonly rows = signal<WholesaleCustomer[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly form = signal<CustomerForm | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected editId: number | null = null;
  protected type = '';
  private text = '';
  private timer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    void this.load();
  }

  protected fmt(n: number): string {
    return money(n);
  }

  protected search(v: string): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.text = v.trim();
      void this.load();
    }, 250);
  }

  protected async load(): Promise<void> {
    try {
      this.rows.set(await firstValueFrom(this.api.customers({ all: true, search: this.text, type: this.type })));
      this.error.set(null);
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('errors.generic')));
    }
  }

  protected openNew(): void {
    this.editId = null;
    this.formError.set(null);
    this.form.set({ ...EMPTY });
  }

  protected edit(c: WholesaleCustomer): void {
    this.editId = c.id;
    this.formError.set(null);
    this.form.set({
      name: c.name, phone: c.phone, email: c.email, type: c.type, priceTier: c.priceTier, creditLimit: c.creditLimit,
      paymentTermsDays: c.paymentTermsDays, address: c.address, city: c.city, isActive: c.isActive,
    });
  }

  protected async save(f: CustomerForm): Promise<void> {
    this.busy.set(true);
    this.formError.set(null);
    try {
      await firstValueFrom(this.api.saveCustomer({ ...f, creditLimit: +f.creditLimit || 0, paymentTermsDays: +f.paymentTermsDays || 0 }, this.editId ?? undefined));
      this.form.set(null);
      await this.load();
    } catch (e) {
      this.formError.set(errorMessage(e, this.i18n.translate('errors.generic')));
    } finally {
      this.busy.set(false);
    }
  }
}
