import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { HasPermissionDirective } from '../../../core/auth/has-permission.directive';
import { SendEmailComponent } from '../../email/ui/send-email.component';
import { PrintService } from '../../../shared/ui/print/print.service';
import { PAY_METHODS, PayMethod } from '../../pos/models/pos.models';
import { money } from '../../pos/utils/pos-utils';
import { UI, errorMessage } from '../../purchase/utils/ui';
import { CustomerLedger, CustomerReceipt, LedgerEntry } from '../models/sales.models';
import { SalesService } from '../services/sales.service';
import { allocationProblem, daysLate, fifoAllocate } from '../utils/ledger-utils';
import { newKey } from '../utils/sales-print';

/** Step 13: customer ka khata (statement), print, aur payment wasool (FIFO ya chuni hui invoices). */
@Component({
  selector: 'app-customer-ledger-page',
  imports: [FormsModule, RouterLink, TranslocoPipe, HasPermissionDirective, SendEmailComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl space-y-4">
      @if (error(); as e) { <p role="alert" class="text-sm text-red-600">{{ e }}</p> }
      @if (l(); as l) {
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h1 class="text-xl font-semibold">{{ 'ledgerPage.title' | transloco }}: {{ l.customer.name }}</h1>
          <div class="flex flex-wrap gap-2">
            <a routerLink="/customers" [class]="ui.btn">{{ 'salesDocs.back' | transloco }}</a>
            <button type="button" [class]="ui.btn" (click)="print(l)">{{ 'ledgerPage.printStatement' | transloco }}</button>
            <app-send-email *hasPermission="'email.message.send'" kind="statement" [refId]="l.customer.id" />
            @if (due() > 0) {
              <button *hasPermission="'sales.invoice.edit'" type="button" [class]="ui.primary" (click)="openReceive()">{{ 'ledgerPage.receive' | transloco }}</button>
            }
          </div>
        </div>

        <div [class]="ui.card + ' grid gap-3 text-sm sm:grid-cols-4'">
          <div>{{ 'ledgerPage.balance' | transloco }}<br /><b class="text-lg" [class.text-red-600]="due() > 0">{{ fmt(due()) }}</b></div>
          <div>{{ 'customersPage.creditLimit' | transloco }}<br /><b>{{ l.customer.creditLimit ? fmt(l.customer.creditLimit) : ('customersPage.cashOnly' | transloco) }}</b></div>
          <div>{{ 'customersPage.terms' | transloco }}<br /><b>{{ l.customer.paymentTermsDays }}</b></div>
          <div>{{ 'ledgerPage.openBills' | transloco }}<br /><b>{{ l.open.length }}</b></div>
        </div>

        @if (receiving()) {
          <div [class]="ui.card + ' space-y-3'">
            <h2 class="font-semibold">{{ 'ledgerPage.receive' | transloco }}</h2>
            <div class="flex flex-wrap items-end gap-2">
              <label class="text-sm font-medium">{{ 'posPage.amount' | transloco }}
                <input placeholder="Type here..." type="number" min="0" [class]="ui.input + ' mt-1 w-40'" [ngModel]="amount()" (ngModelChange)="amount.set(+$event || 0)" /></label>
              <label class="text-sm font-medium">{{ 'posPage.payment' | transloco }}
                <select [class]="ui.input + ' mt-1'" [(ngModel)]="method">
                  @for (m of methods; track m) { <option [ngValue]="m">{{ 'posPage.methods.' + m | transloco }}</option> }
                </select></label>
              <label class="text-sm font-medium">{{ 'salesDocs.reference' | transloco }}
                <input placeholder="Type here..." [class]="ui.input + ' mt-1'" [(ngModel)]="reference" /></label>
              <label class="flex min-h-11 items-center gap-2 text-sm">
                <input type="checkbox" class="h-5 w-5" [ngModel]="manual()" (ngModelChange)="manual.set($event)" /> {{ 'ledgerPage.pickBills' | transloco }}</label>
            </div>
            <table class="w-full text-sm">
              <thead [class]="ui.thead"><tr>
                <th scope="col" [class]="ui.th">{{ 'salesDocs.invoice' | transloco }}</th>
                <th scope="col" [class]="ui.th">{{ 'salesDocs.dueDate' | transloco }}</th>
                <th scope="col" [class]="ui.th + ' text-end'">{{ 'salesDocs.balance' | transloco }}</th>
                <th scope="col" [class]="ui.th + ' text-end'">{{ 'ledgerPage.applied' | transloco }}</th>
              </tr></thead>
              <tbody>
                @for (i of l.open; track i.id) {
                  <tr [class]="ui.tr">
                    <td [class]="ui.td"><a [routerLink]="['/sales/invoices', i.id]" class="text-[#1E3A8A] underline dark:text-sky-300">{{ i.number }}</a> · {{ i.date }}</td>
                    <td [class]="ui.td" [class.text-red-600]="late(i.dueDate) > 0">{{ i.dueDate ?? '—' }}
                      @if (late(i.dueDate) > 0) { · {{ 'ledgerPage.daysLate' | transloco: { n: late(i.dueDate) } }} }</td>
                    <td [class]="ui.td + ' text-end'">{{ fmt(i.balance) }}</td>
                    <td [class]="ui.td + ' text-end'">
                      @if (manual()) {
                        <input placeholder="Type here..." type="number" min="0" [max]="i.balance" class="min-h-9 w-32 rounded border border-slate-400 bg-transparent px-2 text-end"
                          [attr.aria-label]="('ledgerPage.applied' | transloco) + ' ' + i.number" [ngModel]="alloc()[i.id] ?? 0" (ngModelChange)="setAlloc(i.id, $event)" />
                      } @else { {{ fmt(fifo()[i.id] ?? 0) }} }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
            @if (problem(); as p) { <p class="text-sm text-red-600" aria-live="polite">{{ p | transloco }}</p> }
            @if (formError(); as e) { <p role="alert" class="text-sm text-red-600">{{ e }}</p> }
            <div class="flex justify-end gap-2">
              <button type="button" [class]="ui.btn" (click)="receiving.set(false)">{{ 'common.cancel' | transloco }}</button>
              <button type="button" [class]="ui.primary" [disabled]="!!problem() || busy()" (click)="save()">{{ 'salesDocs.save' | transloco }}</button>
            </div>
          </div>
        }
        @if (last(); as r) {
          <p role="status" class="rounded-xl border border-green-600 p-3 text-sm">{{ 'ledgerPage.saved' | transloco: { number: r.number, amount: fmt(r.amount) } }}
            {{ r.allocations.map(a => a.number).join(', ') }}</p>
        }

        <div class="flex flex-wrap items-end gap-2">
          <label class="text-sm font-medium">{{ 'ledgerPage.from' | transloco }}<input type="date" [class]="ui.input + ' mt-1'" [(ngModel)]="from" /></label>
          <label class="text-sm font-medium">{{ 'ledgerPage.to' | transloco }}<input type="date" [class]="ui.input + ' mt-1'" [(ngModel)]="to" /></label>
          <button type="button" [class]="ui.btn" (click)="load()">{{ 'ledgerPage.show' | transloco }}</button>
        </div>
        <div [class]="ui.tableWrap">
          <table class="w-full min-w-[44rem] text-sm">
            <thead [class]="ui.thead"><tr>
              <th scope="col" [class]="ui.th">{{ 'salesDocs.date' | transloco }}</th>
              <th scope="col" [class]="ui.th">{{ 'ledgerPage.details' | transloco }}</th>
              <th scope="col" [class]="ui.th + ' text-end'">{{ 'ledgerPage.debit' | transloco }}</th>
              <th scope="col" [class]="ui.th + ' text-end'">{{ 'ledgerPage.credit' | transloco }}</th>
              <th scope="col" [class]="ui.th + ' text-end'">{{ 'ledgerPage.balance' | transloco }}</th>
            </tr></thead>
            <tbody>
              <tr [class]="ui.tr"><td [class]="ui.td">{{ l.from ?? '' }}</td><td [class]="ui.td + ' font-medium'">{{ 'ledgerPage.opening' | transloco }}</td>
                <td [class]="ui.td"></td><td [class]="ui.td"></td><td [class]="ui.td + ' text-end font-medium'">{{ fmt(l.opening) }}</td></tr>
              @for (e of l.entries; track $index) {
                <tr [class]="ui.tr">
                  <td [class]="ui.td">{{ e.date.slice(0, 10) }}</td>
                  <td [class]="ui.td">{{ 'ledgerPage.types.' + e.type | transloco }} ·
                    @if (e.type === 'invoice' || e.type === 'payment') {
                      <a [routerLink]="['/sales/invoices', e.refId]" class="text-[#1E3A8A] underline dark:text-sky-300">{{ e.ref }}</a>
                    } @else { {{ e.ref }} }
                    @if (e.note) { <span class="text-xs text-slate-600 dark:text-slate-400"> · {{ e.note }}</span> }</td>
                  <td [class]="ui.td + ' text-end'">{{ e.debit ? fmt(e.debit) : '' }}</td>
                  <td [class]="ui.td + ' text-end'">{{ e.credit ? fmt(e.credit) : '' }}</td>
                  <td [class]="ui.td + ' text-end'">{{ fmt(e.balance) }}</td>
                </tr>
              }
            </tbody>
            <tfoot><tr class="font-semibold"><td colspan="2" class="px-3 py-2 text-end">{{ 'ledgerPage.closing' | transloco }}</td>
              <td class="px-3 py-2 text-end">{{ fmt(l.totalDebit) }}</td><td class="px-3 py-2 text-end">{{ fmt(l.totalCredit) }}</td>
              <td class="px-3 py-2 text-end">{{ fmt(l.closing) }}</td></tr></tfoot>
          </table>
        </div>
      }
    </section>
  `,
})
export class CustomerLedgerPage implements OnInit {
  private readonly api = inject(SalesService);
  private readonly i18n = inject(TranslocoService);
  private readonly route = inject(ActivatedRoute);
  private readonly printer = inject(PrintService);
  protected readonly ui = UI;
  protected readonly methods = PAY_METHODS;
  private readonly id = Number(this.route.snapshot.paramMap.get('id'));
  protected readonly l = signal<CustomerLedger | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly formError = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly receiving = signal(false);
  protected readonly manual = signal(false);
  protected readonly amount = signal(0);
  protected readonly alloc = signal<Record<number, number>>({});
  protected readonly last = signal<CustomerReceipt | null>(null);
  protected method: PayMethod = 'transfer';
  protected reference = '';
  protected from = '';
  protected to = '';
  private key = newKey();

  protected readonly due = computed(() => (this.l()?.open ?? []).reduce((a, i) => a + i.balance, 0));
  protected readonly fifo = computed(() =>
    Object.fromEntries(fifoAllocate(this.l()?.open ?? [], this.amount()).map((a) => [a.invoiceId, a.amount])) as Record<number, number>,
  );
  protected readonly problem = computed(() =>
    allocationProblem(this.l()?.open ?? [], this.amount(), this.manual() ? this.alloc() : {}) ??
    (this.manual() && !Object.values(this.alloc()).some((v) => v > 0) ? 'ledgerPage.errors.notMatching' : null),
  );

  ngOnInit(): void {
    void this.load();
  }

  protected fmt(n: number): string {
    return money(n);
  }

  protected late(d: string | null): number {
    return daysLate(d);
  }

  protected async load(): Promise<void> {
    try {
      this.l.set(await firstValueFrom(this.api.ledger(this.id, this.from || null, this.to || null)));
      this.error.set(null);
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('errors.generic')));
    }
  }

  protected openReceive(): void {
    this.receiving.set(true);
    this.amount.set(Math.round(this.due() * 100) / 100);
    this.alloc.set({});
    this.manual.set(false);
    this.formError.set(null);
    this.key = newKey();
  }

  protected setAlloc(id: number, v: unknown): void {
    this.alloc.update((a) => ({ ...a, [id]: Math.max(0, +(v as number) || 0) }));
  }

  protected async save(): Promise<void> {
    this.busy.set(true);
    this.formError.set(null);
    try {
      const allocations = this.manual()
        ? Object.entries(this.alloc()).filter(([, v]) => v > 0).map(([k, v]) => ({ invoiceId: Number(k), amount: v }))
        : undefined;
      const r = await firstValueFrom(this.api.receive(this.id, {
        method: this.method, amount: this.amount(), reference: this.reference.trim() || null, note: null, allocations,
      }, this.key));
      this.last.set(r);
      this.receiving.set(false);
      this.reference = '';
      await this.load();
    } catch (e) {
      this.formError.set(errorMessage(e, this.i18n.translate('errors.generic')));
    } finally {
      this.busy.set(false);
    }
  }

  protected print(l: CustomerLedger): void {
    const t = (k: string): string => this.i18n.translate(k);
    const esc = (s: string): string =>
      s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
    const row = (e: Pick<LedgerEntry, 'date' | 'debit' | 'credit' | 'balance'> & { text: string }): string =>
      `<tr><td>${esc(e.date.slice(0, 10))}</td><td>${esc(e.text)}</td><td class="r">${e.debit ? money(e.debit) : ''}</td><td class="r">${e.credit ? money(e.credit) : ''}</td><td class="r">${money(e.balance)}</td></tr>`;
    const body = `<style>.st{font:12px/1.4 system-ui,sans-serif}.st h1{margin:0;color:#1E3A8A}.st h1 span{color:#00BCD4}.st table{width:100%;border-collapse:collapse;margin-top:10px}
.st td,.st th{border-bottom:1px solid #ccc;padding:3px;text-align:start}.st .r{text-align:end}</style><div class="st">
<h1>Novastack<span>hub</span></h1><p style="margin:0">Empowering Digital Vision</p>
<h2 style="margin:10px 0 2px">${esc(t('ledgerPage.statement'))}: ${esc(l.customer.name)} ${esc(l.customer.phone)}</h2>
<p style="margin:0">${esc(l.from ?? '')} – ${esc(l.to ?? new Date().toISOString().slice(0, 10))}</p>
<table><thead><tr><th scope="col">${esc(t('salesDocs.date'))}</th><th scope="col">${esc(t('ledgerPage.details'))}</th><th scope="col" class="r">${esc(t('ledgerPage.debit'))}</th><th scope="col" class="r">${esc(t('ledgerPage.credit'))}</th><th scope="col" class="r">${esc(t('ledgerPage.balance'))}</th></tr></thead><tbody>
${row({ date: l.from ?? '', text: t('ledgerPage.opening'), debit: 0, credit: 0, balance: l.opening })}
${l.entries.map((e) => row({ ...e, text: `${t('ledgerPage.types.' + e.type)} ${e.ref}` })).join('')}
</tbody></table><p style="margin-top:12px"><b>${esc(t('ledgerPage.closing'))}: ${money(l.closing)}</b></p></div>`;
    void this.printer.print({ title: `${t('ledgerPage.statement')} ${l.customer.name}`, paper: 'a4', body });
  }
}
