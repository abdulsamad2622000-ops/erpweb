import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { PrintService } from '../../../shared/ui/print/print.service';
import { money } from '../../pos/utils/pos-utils';
import { UI, errorMessage } from '../../purchase/utils/ui';
import { CashBook } from '../models/accounts.models';
import { AccountsService } from '../services/accounts.service';

/** Cash book: din/dauran ki aamad aur kharch, opening/closing balance (cash, card, transfer ya sab). */
@Component({
  selector: 'app-cashbook-page',
  imports: [FormsModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">{{ 'cashbookPage.title' | transloco }}</h1>
        @if (cb()) { <button type="button" [class]="ui.btn" (click)="print(cb()!)">{{ 'salesDocs.print' | transloco }}</button> }
      </div>
      <div class="flex flex-wrap items-end gap-2">
        <label class="text-sm font-medium">{{ 'ledgerPage.from' | transloco }}<input type="date" [class]="ui.input + ' mt-1'" [(ngModel)]="from" /></label>
        <label class="text-sm font-medium">{{ 'ledgerPage.to' | transloco }}<input type="date" [class]="ui.input + ' mt-1'" [(ngModel)]="to" /></label>
        <label class="text-sm font-medium">{{ 'posPage.payment' | transloco }}
          <select [class]="ui.input + ' mt-1'" [(ngModel)]="method">
            @for (m of methods; track m) { <option [value]="m">{{ (m === 'all' ? 'salesDocs.all' : 'posPage.methods.' + m) | transloco }}</option> }
          </select></label>
        <button type="button" [class]="ui.primary" (click)="load()">{{ 'ledgerPage.show' | transloco }}</button>
      </div>
      @if (error(); as e) { <p role="alert" class="text-sm text-red-600">{{ e }}</p> }
      @if (cb(); as c) {
        <div class="grid gap-3 sm:grid-cols-4">
          <div [class]="ui.card">{{ 'ledgerPage.opening' | transloco }}<br /><b class="text-lg">Rs {{ fmt(c.opening) }}</b></div>
          <div [class]="ui.card">{{ 'cashbookPage.in' | transloco }}<br /><b class="text-lg text-green-700 dark:text-green-400">Rs {{ fmt(c.totalIn) }}</b></div>
          <div [class]="ui.card">{{ 'cashbookPage.out' | transloco }}<br /><b class="text-lg text-red-600">Rs {{ fmt(c.totalOut) }}</b></div>
          <div [class]="ui.card">{{ 'ledgerPage.closing' | transloco }}<br /><b class="text-lg">Rs {{ fmt(c.closing) }}</b></div>
        </div>
        <div [class]="ui.tableWrap">
          <table class="w-full min-w-[48rem] text-sm">
            <thead [class]="ui.thead"><tr>
              <th scope="col" [class]="ui.th">{{ 'cashbookPage.time' | transloco }}</th>
              <th scope="col" [class]="ui.th">{{ 'ledgerPage.details' | transloco }}</th>
              <th scope="col" [class]="ui.th">{{ 'posPage.payment' | transloco }}</th>
              <th scope="col" [class]="ui.th + ' text-end'">{{ 'cashbookPage.in' | transloco }}</th>
              <th scope="col" [class]="ui.th + ' text-end'">{{ 'cashbookPage.out' | transloco }}</th>
              <th scope="col" [class]="ui.th + ' text-end'">{{ 'ledgerPage.balance' | transloco }}</th>
            </tr></thead>
            <tbody>
              @for (e of c.entries; track $index) {
                <tr [class]="ui.tr">
                  <td [class]="ui.td">{{ e.at.slice(0, 16).replace('T', ' ') }}</td>
                  <td [class]="ui.td">{{ 'cashbookPage.types.' + e.type | transloco }} · {{ e.ref }}
                    @if (e.note) { <span class="text-xs text-slate-600 dark:text-slate-400"> · {{ e.note }}</span> }</td>
                  <td [class]="ui.td">{{ 'posPage.methods.' + e.method | transloco }}</td>
                  <td [class]="ui.td + ' text-end'">{{ e.in ? fmt(e.in) : '' }}</td>
                  <td [class]="ui.td + ' text-end'">{{ e.out ? fmt(e.out) : '' }}</td>
                  <td [class]="ui.td + ' text-end'">{{ fmt(e.balance) }}</td>
                </tr>
              } @empty { <tr><td colspan="6" class="px-4 py-6 text-center text-slate-500">{{ 'common.empty' | transloco }}</td></tr> }
            </tbody>
          </table>
        </div>
        <p class="text-xs text-slate-600 dark:text-slate-400">{{ 'cashbookPage.note' | transloco }}</p>
      }
    </section>
  `,
})
export class CashbookPage implements OnInit {
  private readonly api = inject(AccountsService);
  private readonly i18n = inject(TranslocoService);
  private readonly printer = inject(PrintService);
  protected readonly ui = UI;
  protected readonly methods = ['cash', 'card', 'transfer', 'all'];
  protected readonly cb = signal<CashBook | null>(null);
  protected readonly error = signal<string | null>(null);
  protected from = new Date().toISOString().slice(0, 10);
  protected to = this.from;
  protected method = 'cash';

  ngOnInit(): void {
    void this.load();
  }

  protected fmt(n: number): string {
    return money(n);
  }

  protected async load(): Promise<void> {
    try {
      this.cb.set(await firstValueFrom(this.api.cashbook(this.from, this.to, this.method)));
      this.error.set(null);
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('errors.generic')));
    }
  }

  protected print(c: CashBook): void {
    const t = (k: string): string => this.i18n.translate(k);
    const esc = (s: string): string =>
      s.replace(/[&<>"']/g, (x) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[x] as string);
    const rows = c.entries.map((e) => `<tr><td>${esc(e.at.slice(0, 16).replace('T', ' '))}</td><td>${esc(t('cashbookPage.types.' + e.type))} ${esc(e.ref)}</td>
<td class="r">${e.in ? money(e.in) : ''}</td><td class="r">${e.out ? money(e.out) : ''}</td><td class="r">${money(e.balance)}</td></tr>`).join('');
    void this.printer.print({
      title: t('cashbookPage.title'), paper: 'a4',
      body: `<style>.cb{font:12px/1.4 system-ui,sans-serif}.cb h1{margin:0;color:#1E3A8A}.cb h1 span{color:#00BCD4}.cb table{width:100%;border-collapse:collapse;margin-top:8px}
.cb td,.cb th{border-bottom:1px solid #ccc;padding:3px;text-align:start}.cb .r{text-align:end}</style><div class="cb"><h1>Novastack<span>hub</span></h1>
<h2 style="margin:8px 0 2px">${esc(t('cashbookPage.title'))} · ${esc(c.method === 'all' ? t('salesDocs.all') : t('posPage.methods.' + c.method))}</h2>
<p style="margin:0">${esc(c.from)} – ${esc(c.to)} · ${esc(t('ledgerPage.opening'))}: ${money(c.opening)}</p>
<table><thead><tr><th scope="col">${esc(t('cashbookPage.time'))}</th><th scope="col">${esc(t('ledgerPage.details'))}</th><th scope="col" class="r">${esc(t('cashbookPage.in'))}</th><th scope="col" class="r">${esc(t('cashbookPage.out'))}</th><th scope="col" class="r">${esc(t('ledgerPage.balance'))}</th></tr></thead>
<tbody>${rows}</tbody></table><p><b>${esc(t('ledgerPage.closing'))}: ${money(c.closing)}</b></p></div>`,
    });
  }
}
