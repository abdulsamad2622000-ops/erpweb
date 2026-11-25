import {
  ChangeDetectionStrategy, Component, HostListener, OnInit, computed, inject, signal, viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { Warehouse } from '../../settings/models/org.models';
import { WarehousesService } from '../../settings/services/org.service';
import { ModalComponent } from '../../../shared/ui/modal/modal.component';
import { PrintService } from '../../../shared/ui/print/print.service';
import { ScanEvent, ScanInputComponent } from '../../../shared/ui/scan-input/scan-input.component';
import { UI, errorMessage } from '../../purchase/utils/ui';
import {
  CartLine, Customer, HeldBill, PAY_METHODS, PayMethod, Payment, PosSearchResult, PosShift, Sale,
} from '../models/pos.models';
import { PosService } from '../services/pos.service';
import {
  addToCart, lineTotal, maxDiscount, money, receiptHtml, round2, saleProblem, totals,
} from '../utils/pos-utils';

/** Step 12: full-screen retail POS. F2 scan, F4 search, F8 hold, F9 pay, Esc clear. */
@Component({
  selector: 'app-pos-page',
  imports: [FormsModule, RouterLink, TranslocoPipe, ScanInputComponent, ModalComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <p class="p-6 text-sm" role="status">{{ 'common.loading' | transloco }}</p>
    } @else if (!shift()) {
      <!-- Shift kholo -->
      <section class="mx-auto max-w-md space-y-4 p-4">
        <h1 class="text-xl font-semibold">{{ 'posPage.openShiftTitle' | transloco }}</h1>
        <div [class]="ui.card + ' space-y-3'">
          <label for="pos-wh" class="block text-sm font-medium">{{ 'posPage.counter' | transloco }}</label>
          <select id="pos-wh" [class]="ui.input" [(ngModel)]="openWh">
            <option [ngValue]="0">{{ 'posPage.pickCounter' | transloco }}</option>
            @for (w of warehouses(); track w.id) {
              <option [ngValue]="w.id">{{ w.name }}</option>
            }
          </select>
          <label for="pos-open-cash" class="block text-sm font-medium">{{ 'posPage.openingCash' | transloco }}</label>
          <input id="pos-open-cash" type="number" min="0" inputmode="decimal" [class]="ui.input" [(ngModel)]="openCash" />
          @if (error(); as e) {
            <p role="alert" class="text-sm text-red-600">{{ e }}</p>
          }
          <button type="button" [class]="ui.primary + ' w-full'" [disabled]="busy() || !openWh" (click)="openShift()">
            {{ 'posPage.openShift' | transloco }}
          </button>
        </div>
      </section>
    } @else {
      <section class="flex min-h-[calc(100vh-4rem)] flex-col gap-3 p-3 lg:flex-row" aria-labelledby="pos-title">
        <!-- Bayan: scan, search, cart -->
        <div class="flex min-w-0 flex-1 flex-col gap-3">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h1 id="pos-title" class="text-lg font-semibold">
              {{ 'posPage.title' | transloco }} · {{ shift()!.warehouseName }}
            </h1>
            <div class="flex flex-wrap gap-2">
              <button type="button" [class]="ui.btn" (click)="holdBill()" [disabled]="!cart().length || busy()">
                {{ 'posPage.hold' | transloco }} <kbd class="ms-1 text-xs opacity-70">F8</kbd>
              </button>
              <button type="button" [class]="ui.btn" (click)="toggleHolds()">
                {{ 'posPage.recall' | transloco }} ({{ holds().length }})
              </button>
              <a routerLink="/sales/returns" [class]="ui.btn">{{ 'posPage.returns' | transloco }}</a>
              <button type="button" [class]="ui.btn" (click)="panel.set('close')">{{ 'posPage.closeShift' | transloco }}</button>
            </div>
          </div>

          <div [class]="ui.card + ' grid gap-3 md:grid-cols-2'">
            <div>
              <label for="pos-scan" class="mb-1 block text-sm font-medium">
                {{ 'posPage.scan' | transloco }} <kbd class="text-xs opacity-70">F2</kbd>
              </label>
              <app-scan-input #scan inputId="pos-scan" [placeholder]="'posPage.scanHint' | transloco" (scanned)="onScan($event)" />
            </div>
            <div class="relative">
              <label for="pos-search" class="mb-1 block text-sm font-medium">
                {{ 'posPage.search' | transloco }} <kbd class="text-xs opacity-70">F4</kbd>
              </label>
              <input
                id="pos-search"
                #searchBox
                autocomplete="off"
                [class]="ui.input"
                [placeholder]="'posPage.searchHint' | transloco"
                (input)="onSearch(searchBox.value)"
              />
              @if (results().length) {
                <ul
                  class="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded-lg border border-slate-300 bg-white shadow-lg dark:border-slate-600 dark:bg-slate-900"
                  [attr.aria-label]="'posPage.results' | transloco"
                >
                  @for (r of results(); track r.productId) {
                    <li class="border-b border-slate-100 p-2 last:border-0 dark:border-slate-800">
                      <div class="flex justify-between gap-2 text-sm">
                        <span class="font-medium">{{ r.name }}</span>
                        <span>{{ fmt(r.price ?? 0) }}</span>
                      </div>
                      <div class="text-xs text-slate-600 dark:text-slate-400">
                        {{ r.sku }} · {{ 'posPage.inStock' | transloco: { n: r.inStock } }}
                      </div>
                      @if (r.serialized) {
                        <div class="mt-1 flex flex-wrap gap-1">
                          @for (s of r.serials; track s) {
                            <button type="button" class="min-h-9 rounded border border-slate-300 px-2 text-xs dark:border-slate-600" (click)="pickSerial(r, s)">
                              <code dir="ltr">{{ s }}</code>
                            </button>
                          }
                        </div>
                      } @else {
                        <button type="button" [class]="ui.btn + ' mt-1 min-h-9'" (click)="pickItem(r)">{{ 'posPage.add' | transloco }}</button>
                      }
                    </li>
                  }
                </ul>
              }
            </div>
            @if (notice(); as n) {
              <p role="alert" class="text-sm text-red-600 md:col-span-2">{{ n }}</p>
            }
          </div>

          <div [class]="ui.tableWrap + ' flex-1'">
            <table class="w-full text-sm">
              <caption class="sr-only">{{ 'posPage.cart' | transloco }}</caption>
              <thead [class]="ui.thead">
                <tr>
                  <th scope="col" [class]="ui.th">{{ 'posPage.item' | transloco }}</th>
                  <th scope="col" [class]="ui.th">{{ 'posPage.qty' | transloco }}</th>
                  <th scope="col" [class]="ui.th + ' text-end'">{{ 'posPage.price' | transloco }}</th>
                  <th scope="col" [class]="ui.th + ' text-end'">{{ 'posPage.amount' | transloco }}</th>
                  <th scope="col" [class]="ui.th"><span class="sr-only">{{ 'posPage.remove' | transloco }}</span></th>
                </tr>
              </thead>
              <tbody>
                @for (l of cart(); track $index) {
                  <tr [class]="ui.tr">
                    <td [class]="ui.td">
                      <div class="font-medium">{{ l.name }}</div>
                      <div class="text-xs text-slate-600 dark:text-slate-400">
                        @if (l.serial) { <code dir="ltr">{{ l.serial }}</code> · }
                        {{ l.sku }}
                        @if (l.warrantyMonths) { · {{ 'posPage.warrantyM' | transloco: { n: l.warrantyMonths } }} }
                      </div>
                    </td>
                    <td [class]="ui.td">
                      @if (l.serial) {
                        1
                      } @else {
                        <input type="number" min="1" class="min-h-9 w-20 rounded border border-slate-400 bg-transparent px-2"
                          [attr.aria-label]="('posPage.qty' | transloco) + ' ' + l.name"
                          [ngModel]="l.qty" (ngModelChange)="setQty($index, $event)" />
                      }
                    </td>
                    <td [class]="ui.td + ' text-end'">{{ fmt(l.price ?? 0) }}</td>
                    <td [class]="ui.td + ' text-end font-medium'">{{ fmt(lineAmount(l)) }}</td>
                    <td [class]="ui.td">
                      <button type="button" class="inline-flex min-h-11 min-w-11 items-center justify-center text-red-600"
                        [attr.aria-label]="('posPage.remove' | transloco) + ' ' + l.name" (click)="removeLine($index)">
                        <i class="pi pi-trash" aria-hidden="true"></i>
                      </button>
                    </td>
                  </tr>
                } @empty {
                  <tr><td colspan="5" class="p-8 text-center text-slate-600 dark:text-slate-400">{{ 'posPage.emptyCart' | transloco }}</td></tr>
                }
              </tbody>
            </table>
          </div>
        </div>

        <!-- Dayan: customer, discount, payment -->
        <aside class="flex w-full flex-col gap-3 lg:w-96" [attr.aria-label]="'posPage.checkout' | transloco">
          <div [class]="ui.card + ' space-y-2'">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium">{{ 'posPage.customer' | transloco }}</span>
              @if (customer(); as c) {
                <button type="button" class="text-sm text-[#1E3A8A] underline dark:text-cyan-400" (click)="customer.set(null)">
                  {{ 'posPage.walkIn' | transloco }}
                </button>
              }
            </div>
            @if (customer(); as c) {
              <p class="text-sm"><b>{{ c.name }}</b> · <span dir="ltr">{{ c.phone }}</span></p>
            } @else {
              <p class="text-sm text-slate-600 dark:text-slate-400">{{ 'posPage.walkIn' | transloco }}</p>
              <div class="flex gap-2">
                <input #cq [class]="ui.input" [attr.aria-label]="'posPage.findCustomer' | transloco"
                  [placeholder]="'posPage.findCustomer' | transloco" (input)="findCustomer(cq.value)" />
                <button type="button" [class]="ui.btn" (click)="panel.set('customer')">{{ 'posPage.newCustomer' | transloco }}</button>
              </div>
              @for (c of customerHits(); track c.id) {
                <button type="button" class="block min-h-9 w-full rounded px-2 text-start text-sm hover:bg-slate-100 dark:hover:bg-slate-800" (click)="pickCustomer(c)">
                  {{ c.name }} · <span dir="ltr">{{ c.phone }}</span>
                </button>
              }
            }
          </div>

          <div [class]="ui.card + ' space-y-2 text-sm'">
            <div class="flex justify-between"><span>{{ 'posPage.subtotal' | transloco }}</span><span>{{ fmt(t().subtotal) }}</span></div>
            <div class="flex items-center justify-between gap-2">
              <label for="pos-disc">
                {{ 'posPage.discount' | transloco }}
                <span class="text-xs text-slate-600 dark:text-slate-400">
                  ({{ limit() === null ? ('posPage.noLimit' | transloco) : ('posPage.maxPct' | transloco: { n: limit() }) }})
                </span>
              </label>
              <input id="pos-disc" type="number" min="0" class="min-h-9 w-32 rounded border border-slate-400 bg-transparent px-2 text-end"
                [ngModel]="discount()" (ngModelChange)="discount.set(+$event || 0)" />
            </div>
            <p class="text-xs text-slate-600 dark:text-slate-400">{{ 'posPage.maxRs' | transloco: { n: fmt(maxDisc()) } }}</p>
            <div class="flex justify-between border-t border-slate-200 pt-2 text-lg font-semibold dark:border-slate-700">
              <span>{{ 'posPage.total' | transloco }}</span><span>{{ fmt(t().total) }}</span>
            </div>
          </div>

          <div [class]="ui.card + ' space-y-2'">
            <fieldset>
              <legend class="mb-2 text-sm font-medium">{{ 'posPage.payment' | transloco }}</legend>
              <div class="grid grid-cols-4 gap-1">
                @for (m of methods; track m) {
                  <button type="button" class="min-h-11 rounded-lg border text-sm"
                    [class]="mode() === m ? 'border-[#1E3A8A] bg-[#1E3A8A] text-white' : 'border-slate-400'"
                    [attr.aria-pressed]="mode() === m" (click)="setMode(m)">{{ 'posPage.methods.' + m | transloco }}</button>
                }
                <button type="button" class="min-h-11 rounded-lg border text-sm"
                  [class]="mode() === 'split' ? 'border-[#1E3A8A] bg-[#1E3A8A] text-white' : 'border-slate-400'"
                  [attr.aria-pressed]="mode() === 'split'" (click)="setMode('split')">{{ 'posPage.split' | transloco }}</button>
              </div>
            </fieldset>
            @if (mode() === 'split') {
              @for (m of methods; track m) {
                <div class="flex items-center justify-between gap-2 text-sm">
                  <label [for]="'pos-pay-' + m">{{ 'posPage.methods.' + m | transloco }}</label>
                  <input [id]="'pos-pay-' + m" type="number" min="0" class="min-h-9 w-36 rounded border border-slate-400 bg-transparent px-2 text-end"
                    [ngModel]="split()[m]" (ngModelChange)="setSplit(m, $event)" />
                </div>
              }
            } @else {
              <div class="flex items-center justify-between gap-2 text-sm">
                <label for="pos-tender">{{ 'posPage.tendered' | transloco }}</label>
                <input id="pos-tender" type="number" min="0" class="min-h-9 w-36 rounded border border-slate-400 bg-transparent px-2 text-end"
                  [placeholder]="fmt(t().total)" [ngModel]="tendered()" (ngModelChange)="tendered.set($event === '' || $event === null ? null : +$event)" />
              </div>
            }
            <div class="flex justify-between text-sm"><span>{{ 'posPage.paid' | transloco }}</span><span>{{ fmt(t().paid) }}</span></div>
            @if (t().due > 0) {
              <div class="flex justify-between text-sm text-red-600"><span>{{ 'posPage.due' | transloco }}</span><span>{{ fmt(t().due) }}</span></div>
            }
            @if (t().change > 0) {
              <div class="flex justify-between text-base font-semibold text-green-700 dark:text-green-400">
                <span>{{ 'posPage.change' | transloco }}</span><span>{{ fmt(t().change) }}</span>
              </div>
            }
            @if (problem(); as p) {
              <p class="text-xs text-slate-600 dark:text-slate-400" aria-live="polite">{{ p | transloco: { n: limit() } }}</p>
            }
            <button type="button" [class]="ui.primary + ' min-h-14 w-full text-base'" [disabled]="!!problem() || busy()" (click)="complete()">
              {{ 'posPage.complete' | transloco }} <kbd class="ms-2 text-xs opacity-80">F9</kbd>
            </button>
          </div>
        </aside>
      </section>
    }

    <!-- Panels -->
    @if (panel() === 'holds') {
      <app-modal labelledBy="holds-t" size="md" (closed)="panel.set(null)">
        <div class="space-y-3">
          <h2 id="holds-t" class="font-semibold">{{ 'posPage.heldBills' | transloco }}</h2>
          @for (h of holds(); track h.id) {
            <div class="flex items-center justify-between gap-2 border-b border-slate-100 pb-2 dark:border-slate-800">
              <div class="text-sm"><b>{{ h.label }}</b> · {{ h.payload.lines.length }} {{ 'posPage.items' | transloco }}</div>
              <div class="flex gap-1">
                <button type="button" [class]="ui.primary" (click)="recall(h)">{{ 'posPage.recallOne' | transloco }}</button>
                <button type="button" [class]="ui.danger" (click)="dropHold(h)">{{ 'posPage.remove' | transloco }}</button>
              </div>
            </div>
          } @empty {
            <p class="text-sm text-slate-600 dark:text-slate-400">{{ 'posPage.noHolds' | transloco }}</p>
          }
          <div class="flex justify-end"><button type="button" [class]="ui.btn" (click)="panel.set(null)">{{ 'posPage.close' | transloco }}</button></div>
        </div>
      </app-modal>
    }
    @if (panel() === 'customer') {
      <app-modal labelledBy="cust-t" size="md" (closed)="panel.set(null)">
        <div class="space-y-3">
          <h2 id="cust-t" class="font-semibold">{{ 'posPage.newCustomer' | transloco }}</h2>
          <label for="nc-name" class="block text-sm font-medium">{{ 'posPage.name' | transloco }}</label>
          <input id="nc-name" [class]="ui.input" [(ngModel)]="newName" />
          <label for="nc-phone" class="block text-sm font-medium">{{ 'posPage.phone' | transloco }}</label>
          <input id="nc-phone" type="tel" dir="ltr" [class]="ui.input" [(ngModel)]="newPhone" />
          @if (error(); as e) { <p role="alert" class="text-sm text-red-600">{{ e }}</p> }
          <div class="flex justify-end gap-2">
            <button type="button" [class]="ui.btn" (click)="panel.set(null)">{{ 'common.cancel' | transloco }}</button>
            <button type="button" [class]="ui.primary" [disabled]="busy()" (click)="saveCustomer()">{{ 'common.save' | transloco }}</button>
          </div>
        </div>
      </app-modal>
    }
    @if (panel() === 'close' && shift(); as s) {
      <app-modal labelledBy="close-t" size="md" (closed)="panel.set(null)">
        <div class="space-y-2 text-sm">
          <h2 id="close-t" class="text-base font-semibold">{{ 'posPage.closeShift' | transloco }}</h2>
          <div class="flex justify-between"><span>{{ 'posPage.openingCash' | transloco }}</span><span>{{ fmt(s.openingCash) }}</span></div>
          <div class="flex justify-between"><span>{{ 'posPage.salesCount' | transloco }}</span><span>{{ s.salesCount }} · {{ fmt(s.salesTotal) }}</span></div>
          <div class="flex justify-between"><span>{{ 'posPage.cashRefunds' | transloco }}</span><span>{{ fmt(s.cashRefunds) }}</span></div>
          <div class="flex justify-between font-semibold"><span>{{ 'posPage.expectedCash' | transloco }}</span><span>{{ fmt(s.expectedCash) }}</span></div>
          <label for="cl-cash" class="block font-medium">{{ 'posPage.countedCash' | transloco }}</label>
          <input id="cl-cash" type="number" min="0" [class]="ui.input" [(ngModel)]="countedCash" />
          @if (countedCash !== null && diff(s) !== 0) {
            <p class="text-red-600">{{ 'posPage.difference' | transloco: { n: fmt(diff(s)) } }}</p>
          }
          <label for="cl-note" class="block font-medium">{{ 'posPage.closeNote' | transloco }}</label>
          <textarea id="cl-note" rows="2" [class]="ui.input + ' py-2'" [(ngModel)]="closeNote"></textarea>
          @if (error(); as e) { <p role="alert" class="text-red-600">{{ e }}</p> }
          <div class="flex justify-end gap-2">
            <button type="button" [class]="ui.btn" (click)="panel.set(null)">{{ 'common.cancel' | transloco }}</button>
            <button type="button" [class]="ui.primary" [disabled]="busy() || countedCash === null" (click)="closeShift()">
              {{ 'posPage.closeShift' | transloco }}
            </button>
          </div>
        </div>
      </app-modal>
    }
    @if (panel() === 'done' && lastSale(); as s) {
      <app-modal labelledBy="done-t" size="sm" (closed)="nextSale()">
        <div class="space-y-3 text-center">
          <h2 id="done-t" class="text-lg font-semibold">{{ 'posPage.saleDone' | transloco }}</h2>
          <p class="text-sm">{{ s.number }} · {{ fmt(s.total) }}</p>
          @if (s.change > 0) {
            <p class="text-2xl font-bold text-green-700 dark:text-green-400">{{ 'posPage.change' | transloco }}: {{ fmt(s.change) }}</p>
          }
          <div class="flex justify-center gap-2">
            <button type="button" [class]="ui.btn" (click)="printReceipt(s)">{{ 'posPage.printReceipt' | transloco }}</button>
            <button type="button" [class]="ui.primary" (click)="nextSale()">{{ 'posPage.nextSale' | transloco }}</button>
          </div>
        </div>
      </app-modal>
    }
  `,
})
export class PosPage implements OnInit {
  private readonly api = inject(PosService);
  private readonly whApi = inject(WarehousesService);
  private readonly i18n = inject(TranslocoService);
  private readonly printer = inject(PrintService);
  protected readonly ui = UI;
  protected readonly methods = PAY_METHODS;
  private readonly scanBox = viewChild<ScanInputComponent>('scan');

  protected readonly loading = signal(true);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly shift = signal<PosShift | null>(null);
  protected readonly limit = signal<number | null>(0);
  protected readonly warehouses = signal<Warehouse[]>([]);
  protected readonly panel = signal<'holds' | 'customer' | 'close' | 'done' | null>(null);

  protected readonly cart = signal<CartLine[]>([]);
  protected readonly customer = signal<Customer | null>(null);
  protected readonly discount = signal(0);
  protected readonly mode = signal<PayMethod | 'split'>('cash');
  protected readonly tendered = signal<number | null>(null);
  protected readonly split = signal<Record<PayMethod, number>>({ cash: 0, card: 0, transfer: 0 });
  protected readonly results = signal<PosSearchResult[]>([]);
  protected readonly customerHits = signal<Customer[]>([]);
  protected readonly holds = signal<HeldBill[]>([]);
  protected readonly lastSale = signal<Sale | null>(null);

  protected openWh = 0;
  protected openCash = 0;
  protected newName = '';
  protected newPhone = '';
  protected countedCash: number | null = null;
  protected closeNote = '';
  private searchTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly payments = computed<Payment[]>(() => {
    const m = this.mode();
    if (m === 'split') {
      return this.methods.map((x) => ({ method: x, amount: round2(this.split()[x] || 0) })).filter((p) => p.amount > 0);
    }
    const total = totals(this.cart(), this.discount(), []).total;
    const amount = this.tendered() ?? total;
    return amount > 0 ? [{ method: m, amount: round2(amount) }] : [];
  });
  protected readonly t = computed(() => totals(this.cart(), this.discount(), this.payments()));
  protected readonly maxDisc = computed(() => maxDiscount(this.t().subtotal, this.limit()));
  protected readonly problem = computed(() =>
    this.cart().length ? saleProblem(this.cart(), this.discount(), this.limit(), this.payments()) : null,
  );

  ngOnInit(): void {
    void this.init();
  }

  protected fmt(n: number): string {
    return money(n);
  }

  protected lineAmount(l: CartLine): number {
    return lineTotal(l);
  }

  protected diff(s: PosShift): number {
    return round2((this.countedCash ?? 0) - s.expectedCash);
  }

  private fail(e: unknown): string {
    return errorMessage(e, this.i18n.translate('errors.generic'));
  }

  private async init(): Promise<void> {
    try {
      const st = await firstValueFrom(this.api.shift());
      this.shift.set(st.shift);
      this.limit.set(st.discountLimit);
      if (st.shift) await this.loadHolds();
      else this.warehouses.set((await firstValueFrom(this.whApi.list({ pageSize: 500 }))).data.filter((w) => w.isActive));
    } catch (e) {
      this.error.set(this.fail(e));
    } finally {
      this.loading.set(false);
    }
  }

  private async loadHolds(): Promise<void> {
    try {
      this.holds.set(await firstValueFrom(this.api.holds()));
    } catch {
      this.holds.set([]);
    }
  }

  @HostListener('window:keydown', ['$event'])
  protected onKey(e: KeyboardEvent): void {
    if (!this.shift()) return;
    const keys: Record<string, () => void> = {
      F2: () => this.scanBox()?.focus(),
      F4: () => document.getElementById('pos-search')?.focus(),
      F8: () => void this.holdBill(),
      F9: () => void this.complete(),
      Escape: () => (this.panel() ? this.panel.set(null) : this.results.set([])),
    };
    const fn = keys[e.key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  }

  protected async openShift(): Promise<void> {
    this.error.set(null);
    this.busy.set(true);
    try {
      this.shift.set(await firstValueFrom(this.api.openShift(this.openWh, +this.openCash || 0)));
      await this.loadHolds();
    } catch (e) {
      this.error.set(this.fail(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async closeShift(): Promise<void> {
    if (this.countedCash === null) return;
    this.error.set(null);
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.closeShift(+this.countedCash, this.closeNote.trim() || null));
      this.shift.set(null);
      this.panel.set(null);
      this.resetCart();
      this.countedCash = null;
      this.closeNote = '';
      this.warehouses.set((await firstValueFrom(this.whApi.list({ pageSize: 500 }))).data.filter((w) => w.isActive));
    } catch (e) {
      this.error.set(this.fail(e));
    } finally {
      this.busy.set(false);
    }
  }

  private push(item: Parameters<typeof addToCart>[1]): void {
    const r = addToCart(this.cart(), item);
    if (r.error) this.notice.set(this.i18n.translate(r.error));
    else {
      this.notice.set(null);
      this.cart.set(r.lines);
    }
  }

  protected async onScan(e: ScanEvent): Promise<void> {
    this.notice.set(null);
    try {
      this.push(await firstValueFrom(this.api.scan(e.value)));
    } catch (err) {
      this.notice.set(this.fail(err));
    }
  }

  protected onSearch(q: string): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (q.trim().length < 2) {
      this.results.set([]);
      return;
    }
    this.searchTimer = setTimeout(async () => {
      try {
        this.results.set(await firstValueFrom(this.api.search(q)));
      } catch (err) {
        this.notice.set(this.fail(err));
      }
    }, 250);
  }

  protected pickSerial(r: PosSearchResult, serial: string): void {
    this.push({ ...r, serial });
    this.results.update((rs) =>
      rs.map((x) => (x.productId === r.productId ? { ...x, serials: x.serials.filter((s) => s !== serial) } : x)),
    );
  }

  protected pickItem(r: PosSearchResult): void {
    this.push({ ...r, serial: null });
  }

  protected setQty(i: number, v: unknown): void {
    const q = Math.max(1, Math.floor(+(v as number) || 1));
    this.cart.update((ls) => ls.map((l, j) => (j === i ? { ...l, qty: q } : l)));
  }

  protected removeLine(i: number): void {
    this.cart.update((ls) => ls.filter((_, j) => j !== i));
  }

  protected setMode(m: PayMethod | 'split'): void {
    this.mode.set(m);
    this.tendered.set(null);
    if (m === 'split') this.split.set({ cash: 0, card: 0, transfer: 0 });
  }

  protected setSplit(m: PayMethod, v: unknown): void {
    this.split.update((s) => ({ ...s, [m]: Math.max(0, +(v as number) || 0) }));
  }

  protected async findCustomer(q: string): Promise<void> {
    if (q.trim().length < 2) {
      this.customerHits.set([]);
      return;
    }
    try {
      this.customerHits.set((await firstValueFrom(this.api.customers(q))).slice(0, 6));
    } catch {
      this.customerHits.set([]);
    }
  }

  protected pickCustomer(c: Customer): void {
    this.customer.set(c);
    this.customerHits.set([]);
  }

  protected async saveCustomer(): Promise<void> {
    this.error.set(null);
    this.busy.set(true);
    try {
      this.customer.set(await firstValueFrom(this.api.addCustomer({ name: this.newName.trim(), phone: this.newPhone.trim() })));
      this.newName = '';
      this.newPhone = '';
      this.panel.set(null);
    } catch (e) {
      this.error.set(this.fail(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected toggleHolds(): void {
    this.panel.set(this.panel() === 'holds' ? null : 'holds');
  }

  protected async holdBill(): Promise<void> {
    if (!this.cart().length || this.busy()) return;
    this.busy.set(true);
    try {
      const label = this.customer()?.name ?? `${this.i18n.translate('posPage.bill')} ${new Date().toLocaleTimeString('en-PK')}`;
      await firstValueFrom(this.api.hold(label, { lines: this.cart(), customer: this.customer(), discount: this.discount() }));
      this.resetCart();
      await this.loadHolds();
    } catch (e) {
      this.notice.set(this.fail(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async recall(h: HeldBill): Promise<void> {
    if (this.cart().length) {
      this.notice.set(this.i18n.translate('posPage.holdFirst'));
      this.panel.set(null);
      return;
    }
    this.cart.set(h.payload.lines);
    this.customer.set(h.payload.customer);
    this.discount.set(h.payload.discount);
    this.panel.set(null);
    await this.dropHold(h);
  }

  protected async dropHold(h: HeldBill): Promise<void> {
    try {
      await firstValueFrom(this.api.dropHold(h.id));
    } finally {
      await this.loadHolds();
    }
  }

  protected async complete(): Promise<void> {
    if (this.problem() || !this.cart().length || this.busy()) return;
    this.busy.set(true);
    this.notice.set(null);
    try {
      const sale = await firstValueFrom(
        this.api.complete({
          customerId: this.customer()?.id ?? null,
          lines: this.cart().map((l) => ({ productId: l.productId, serial: l.serial, qty: l.qty })),
          discount: this.t().discount,
          payments: this.payments(),
          note: null,
        }),
      );
      this.lastSale.set(sale);
      this.panel.set('done');
      this.resetCart();
      this.shift.set((await firstValueFrom(this.api.shift())).shift);
    } catch (e) {
      this.notice.set(this.fail(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected printReceipt(s: Sale): void {
    const tr = (k: string): string => this.i18n.translate(`posPage.receipt.${k}`);
    void this.printer.print({
      title: s.number,
      paper: 'thermal80',
      body: receiptHtml(s, {
        shop: 'Novastackhub', tagline: 'Empowering Digital Vision', receipt: tr('receipt'), cashier: tr('cashier'),
        customer: tr('customer'), subtotal: tr('subtotal'), discount: tr('discount'), total: tr('total'), paid: tr('paid'),
        change: tr('change'), warranty: tr('warranty'), thanks: tr('thanks'),
        methods: Object.fromEntries(this.methods.map((m) => [m, this.i18n.translate(`posPage.methods.${m}`)])),
      }),
    });
  }

  protected nextSale(): void {
    this.panel.set(null);
    this.lastSale.set(null);
    setTimeout(() => this.scanBox()?.focus());
  }

  private resetCart(): void {
    this.cart.set([]);
    this.customer.set(null);
    this.discount.set(0);
    this.tendered.set(null);
    this.mode.set('cash');
    this.split.set({ cash: 0, card: 0, transfer: 0 });
    this.results.set([]);
  }
}
