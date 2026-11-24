import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { HasPermissionDirective } from '../../../core/auth/has-permission.directive';
import { ConfirmDialogService } from '../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';
import { PAY_METHODS } from '../../pos/models/pos.models';
import { money } from '../../pos/utils/pos-utils';
import { UI, errorMessage } from '../../purchase/utils/ui';
import { monthRange } from '../../reports/utils/report-utils';
import { newKey } from '../../sales/utils/sales-print';
import { Expense, ExpenseCategory, ExpenseInput } from '../models/accounts.models';
import { AccountsService } from '../services/accounts.service';
import { expenseProblem } from '../utils/accounts-utils';

/** Kharche: list (dates, category), naya/edit, void (wajah ke saath), nayi category. */
@Component({
  selector: 'app-expenses-page',
  imports: [FormsModule, TranslocoPipe, HasPermissionDirective, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">{{ 'expensesPage.title' | transloco }}</h1>
        <button *hasPermission="'accounts.expense.create'" type="button" [class]="ui.primary" (click)="openNew()">+ {{ 'expensesPage.add' | transloco }}</button>
      </div>
      <div class="flex flex-wrap items-end gap-2">
        <label class="text-sm font-medium">{{ 'ledgerPage.from' | transloco }}<input type="date" [class]="ui.input + ' mt-1'" [(ngModel)]="from" /></label>
        <label class="text-sm font-medium">{{ 'ledgerPage.to' | transloco }}<input type="date" [class]="ui.input + ' mt-1'" [(ngModel)]="to" /></label>
        <label class="text-sm font-medium">{{ 'expensesPage.category' | transloco }}
          <select [class]="ui.input + ' mt-1'" [(ngModel)]="catFilter">
            <option [ngValue]="0">{{ 'salesDocs.all' | transloco }}</option>
            @for (c of cats(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
          </select></label>
        <button type="button" [class]="ui.btn" (click)="load()">{{ 'ledgerPage.show' | transloco }}</button>
        <span class="ms-auto text-base font-semibold">{{ 'posPage.total' | transloco }}: Rs {{ fmt(sum()) }}</span>
      </div>
      @if (error(); as e) { <p role="alert" class="text-sm text-red-600">{{ e }}</p> }
      <div [class]="ui.tableWrap">
        <table class="w-full min-w-[48rem] text-sm">
          <thead [class]="ui.thead"><tr>
            <th scope="col" [class]="ui.th">{{ 'salesDocs.date' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'salesDocs.number' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'expensesPage.category' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'expensesPage.paidTo' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'posPage.payment' | transloco }}</th>
            <th scope="col" [class]="ui.th + ' text-end'">{{ 'posPage.amount' | transloco }}</th>
            <th scope="col" [class]="ui.th"><span class="sr-only">{{ 'common.actions' | transloco }}</span></th>
          </tr></thead>
          <tbody>
            @for (e of rows(); track e.id) {
              <tr [class]="ui.tr" [class.line-through]="e.voided" [class.opacity-60]="e.voided">
                <td [class]="ui.td">{{ e.date }}</td><td [class]="ui.td">{{ e.number }}</td><td [class]="ui.td">{{ e.category }}</td>
                <td [class]="ui.td">{{ e.paidTo }} @if (e.note) { <div class="text-xs text-slate-600 dark:text-slate-400">{{ e.note }}</div> }
                  @if (e.voided) { <div class="text-xs text-red-600">{{ 'expensesPage.voided' | transloco }}: {{ e.voidReason }}</div> }</td>
                <td [class]="ui.td">{{ 'posPage.methods.' + e.method | transloco }}</td>
                <td [class]="ui.td + ' text-end'">{{ fmt(e.amount) }}</td>
                <td [class]="ui.td + ' whitespace-nowrap text-end'">
                  @if (!e.voided) {
                    <button *hasPermission="'accounts.expense.edit'" type="button" [class]="ui.btn" (click)="edit(e)">{{ 'common.edit' | transloco }}</button>
                    <button *hasPermission="'accounts.expense.edit'" type="button" [class]="ui.danger + ' ms-1'" (click)="voidIt(e)">{{ 'expensesPage.void' | transloco }}</button>
                  }
                </td>
              </tr>
            } @empty { <tr><td colspan="7" class="px-4 py-6 text-center text-slate-500">{{ 'common.empty' | transloco }}</td></tr> }
          </tbody>
        </table>
      </div>
    </section>

    @if (form(); as f) {
      <app-modal labelledBy="ex-t" size="md" (closed)="closeForm()">
        <div class="grid gap-3 sm:grid-cols-2">
          <h2 id="ex-t" class="font-semibold sm:col-span-2">{{ (editId ? 'expensesPage.edit' : 'expensesPage.add') | transloco }}</h2>
          <label class="text-sm font-medium">{{ 'salesDocs.date' | transloco }}<input type="date" [max]="today" [class]="ui.input + ' mt-1'" [(ngModel)]="f.date" /></label>
          <label class="text-sm font-medium">{{ 'posPage.amount' | transloco }}<input type="number" min="1" [class]="ui.input + ' mt-1'" [(ngModel)]="f.amount" /></label>
          <label class="text-sm font-medium">{{ 'expensesPage.category' | transloco }}
            <select [class]="ui.input + ' mt-1'" [(ngModel)]="f.categoryId">
              <option [ngValue]="0">{{ 'expensesPage.pick' | transloco }}</option>
              @for (c of cats(); track c.id) { <option [ngValue]="c.id">{{ c.name }}</option> }
            </select></label>
          <label class="text-sm font-medium">{{ 'posPage.payment' | transloco }}
            <select [class]="ui.input + ' mt-1'" [(ngModel)]="f.method">
              @for (m of methods; track m) { <option [ngValue]="m">{{ 'posPage.methods.' + m | transloco }}</option> }
            </select></label>
          <div class="flex items-end gap-2 sm:col-span-2" *hasPermission="'accounts.expense.edit'">
            <label class="flex-1 text-sm font-medium">{{ 'expensesPage.newCategory' | transloco }}<input [class]="ui.input + ' mt-1'" [(ngModel)]="newCat" /></label>
            <button type="button" [class]="ui.btn" [disabled]="newCat.trim().length < 2" (click)="addCat(f)">{{ 'common.add' | transloco }}</button>
          </div>
          <label class="text-sm font-medium">{{ 'expensesPage.paidTo' | transloco }}<input [class]="ui.input + ' mt-1'" [(ngModel)]="f.paidTo" /></label>
          <label class="text-sm font-medium">{{ 'salesDocs.reference' | transloco }}<input [class]="ui.input + ' mt-1'" [(ngModel)]="f.reference" /></label>
          <label class="text-sm font-medium sm:col-span-2">{{ 'salesDocs.note' | transloco }}<input [class]="ui.input + ' mt-1'" [(ngModel)]="f.note" /></label>
          @if (formError(); as e) { <p role="alert" class="text-sm text-red-600 sm:col-span-2">{{ e }}</p> }
          <div class="flex justify-end gap-2 sm:col-span-2">
            <button type="button" [class]="ui.btn" (click)="form.set(null)">{{ 'common.cancel' | transloco }}</button>
            <button type="button" [class]="ui.primary" [disabled]="busy()" (click)="save(f)">{{ 'common.save' | transloco }}</button>
          </div>
        </div>
      </app-modal>
    }
  `,
})
export class ExpensesPage implements OnInit {
  private readonly api = inject(AccountsService);
  private readonly i18n = inject(TranslocoService);
  private readonly dialogs = inject(ConfirmDialogService);
  protected readonly ui = UI;
  protected readonly methods = PAY_METHODS;
  protected readonly today = new Date().toISOString().slice(0, 10);
  protected readonly rows = signal<Expense[]>([]);
  protected readonly sum = signal(0);
  protected readonly cats = signal<ExpenseCategory[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly form = signal<ExpenseInput | null>(null);
  protected from = monthRange().from;
  protected to = monthRange().to;
  protected catFilter = 0;
  protected editId: number | null = null;
  protected newCat = '';
  private key = newKey();

  async ngOnInit(): Promise<void> {
    try {
      this.cats.set(await firstValueFrom(this.api.categories()));
    } catch {
      /* list khaali rahegi */
    }
    await this.load();
  }

  protected fmt(n: number): string {
    return money(n);
  }

  private fail(e: unknown): string {
    return errorMessage(e, this.i18n.translate('errors.generic'));
  }

  protected async load(): Promise<void> {
    try {
      const r = await firstValueFrom(this.api.expenses({ from: this.from, to: this.to, categoryId: this.catFilter || null, pageSize: 200 }));
      this.rows.set(r.data);
      this.sum.set(r.sum);
      this.error.set(null);
    } catch (e) {
      this.error.set(this.fail(e));
    }
  }

  /** Esc par band; save chal raha ho to band nahi hota. */
  protected closeForm(): void {
    if (!this.busy()) this.form.set(null);
  }

  protected openNew(): void {
    this.editId = null;
    this.key = newKey();
    this.formError.set(null);
    this.form.set({ date: this.today, categoryId: 0, branchId: null, amount: 0, method: 'cash', paidTo: '', reference: null, note: null });
  }

  protected edit(e: Expense): void {
    this.editId = e.id;
    this.formError.set(null);
    this.form.set({ date: e.date, categoryId: e.categoryId, branchId: e.branchId, amount: e.amount, method: e.method, paidTo: e.paidTo,
      reference: e.reference, note: e.note });
  }

  protected async addCat(f: ExpenseInput): Promise<void> {
    try {
      const c = await firstValueFrom(this.api.addCategory(this.newCat.trim()));
      this.cats.update((x) => [...x, c].sort((a, b) => a.name.localeCompare(b.name)));
      f.categoryId = c.id;
      this.newCat = '';
    } catch (e) {
      this.formError.set(this.fail(e));
    }
  }

  protected async save(f: ExpenseInput): Promise<void> {
    const p = expenseProblem(f, this.today);
    if (p) {
      this.formError.set(this.i18n.translate(p));
      return;
    }
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.save({ ...f, amount: +f.amount, reference: f.reference?.trim() || null, note: f.note?.trim() || null }, this.editId, this.key));
      this.form.set(null);
      await this.load();
    } catch (e) {
      this.formError.set(this.fail(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async voidIt(e: Expense): Promise<void> {
    const reason = await this.dialogs.reason({ title: this.i18n.translate('expensesPage.void'),
      message: this.i18n.translate('expensesPage.voidMsg', { number: e.number }), danger: true });
    if (!reason) return;
    try {
      await firstValueFrom(this.api.void(e.id, reason));
      await this.load();
    } catch (err) {
      this.error.set(this.fail(err));
    }
  }
}
