import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { Product } from '../../products/models';
import { ProductsService } from '../../products/services/products.service';
import { money } from '../../pos/utils/pos-utils';
import { UI, errorMessage } from '../../purchase/utils/ui';
import { WholesaleCustomer } from '../models/sales.models';
import { SalesService } from '../services/sales.service';
import { EditLine, docTotal, lineProblem } from '../utils/sales-utils';

/** Nayi quotation / naya sales order / draft quotation edit. Route data `kind`: quotation | order. */
@Component({
  selector: 'app-sales-doc-form-page',
  imports: [FormsModule, RouterLink, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-5xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">{{ title() | transloco }}</h1>
        <a [routerLink]="back" [class]="ui.btn">{{ 'salesDocs.back' | transloco }}</a>
      </div>

      <div [class]="ui.card + ' grid gap-3 md:grid-cols-2'">
        <div>
          <label for="df-cust" class="mb-1 block text-sm font-medium">{{ 'salesDocs.customer' | transloco }}</label>
          @if (customer(); as c) {
            <div class="flex items-center justify-between gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600">
              <span><b>{{ c.name }}</b> · {{ 'customersPage.types.' + c.priceTier | transloco }}
                · {{ 'customersPage.balance' | transloco }} {{ fmt(c.balance) }}</span>
              <button type="button" class="text-[#1E3A8A] underline dark:text-cyan-400" (click)="clearCustomer()">{{ 'salesDocs.change' | transloco }}</button>
            </div>
          } @else {
            <input id="df-cust" #cq autocomplete="off" [class]="ui.input" [placeholder]="'customersPage.search' | transloco" (input)="findCustomer(cq.value)" />
            @for (c of custHits(); track c.id) {
              <button type="button" class="block min-h-9 w-full rounded px-2 text-start text-sm hover:bg-slate-100 dark:hover:bg-slate-800" (click)="pickCustomer(c)">
                {{ c.name }} · <span dir="ltr">{{ c.phone }}</span> · {{ 'customersPage.types.' + c.type | transloco }}
              </button>
            }
          }
        </div>
        @if (kind === 'quotation') {
          <div>
            <label for="df-valid" class="mb-1 block text-sm font-medium">{{ 'salesDocs.validUntil' | transloco }}</label>
            <input id="df-valid" type="date" [min]="today" [class]="ui.input" [(ngModel)]="validUntil" />
          </div>
        }
      </div>

      <div [class]="ui.card + ' space-y-2'">
        <label for="df-prod" class="block text-sm font-medium">{{ 'salesDocs.addItem' | transloco }}</label>
        <input id="df-prod" #pq autocomplete="off" [class]="ui.input" [disabled]="!customer()"
          [placeholder]="(customer() ? 'posPage.searchHint' : 'salesDocs.pickCustomerFirst') | transloco" (input)="findProduct(pq.value)" />
        @for (p of prodHits(); track p.id) {
          <button type="button" class="block min-h-9 w-full rounded px-2 text-start text-sm hover:bg-slate-100 dark:hover:bg-slate-800" (click)="addProduct(p); pq.value = ''">
            {{ p.name }} · <span dir="ltr">{{ p.sku }}</span>
          </button>
        }
        @if (notice(); as n) { <p role="alert" class="text-sm text-red-600">{{ n }}</p> }
      </div>

      <div [class]="ui.tableWrap">
        <table class="w-full min-w-[40rem] text-sm">
          <thead [class]="ui.thead"><tr>
            <th scope="col" [class]="ui.th">{{ 'posPage.item' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'posPage.qty' | transloco }}</th>
            <th scope="col" [class]="ui.th">{{ 'posPage.price' | transloco }}</th>
            <th scope="col" [class]="ui.th + ' text-end'">{{ 'posPage.amount' | transloco }}</th>
            <th scope="col" [class]="ui.th"><span class="sr-only">{{ 'posPage.remove' | transloco }}</span></th>
          </tr></thead>
          <tbody>
            @for (l of lines(); track l.productId; let i = $index) {
              <tr [class]="ui.tr">
                <td [class]="ui.td"><div class="font-medium">{{ l.name }}</div><div class="text-xs text-slate-600 dark:text-slate-400" dir="ltr">{{ l.sku }}</div></td>
                <td [class]="ui.td"><input type="number" min="1" class="min-h-9 w-20 rounded border border-slate-400 bg-transparent px-2"
                  [attr.aria-label]="('posPage.qty' | transloco) + ' ' + l.name" [ngModel]="l.qty" (ngModelChange)="set(i, 'qty', $event)" /></td>
                <td [class]="ui.td">
                  <input type="number" min="0" class="min-h-9 w-32 rounded border border-slate-400 bg-transparent px-2"
                    [attr.aria-label]="('posPage.price' | transloco) + ' ' + l.name" [ngModel]="l.unitPrice" (ngModelChange)="set(i, 'unitPrice', $event)" />
                  <div class="text-xs text-slate-600 dark:text-slate-400">{{ 'salesDocs.tierLowest' | transloco: { tier: fmt(l.tierPrice), low: fmt(l.lowestPrice) } }}</div>
                  @if (problem(l); as p) { <div class="text-xs text-red-600">{{ p | transloco: { n: fmt(l.lowestPrice) } }}</div> }
                </td>
                <td [class]="ui.td + ' text-end'">{{ fmt(l.qty * l.unitPrice) }}</td>
                <td [class]="ui.td"><button type="button" class="inline-flex min-h-11 min-w-11 items-center justify-center text-red-600"
                  [attr.aria-label]="('posPage.remove' | transloco) + ' ' + l.name" (click)="remove(i)"><i class="pi pi-trash" aria-hidden="true"></i></button></td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="p-6 text-center text-slate-500">{{ 'salesDocs.noItems' | transloco }}</td></tr>
            }
          </tbody>
          <tfoot><tr><td colspan="3" class="px-3 py-2 text-end font-semibold">{{ 'posPage.total' | transloco }}</td>
            <td class="px-3 py-2 text-end font-semibold">{{ fmt(total()) }}</td><td></td></tr></tfoot>
        </table>
      </div>

      <div [class]="ui.card + ' space-y-2'">
        <label for="df-note" class="block text-sm font-medium">{{ 'salesDocs.note' | transloco }}</label>
        <textarea id="df-note" rows="2" [class]="ui.input + ' py-2'" [(ngModel)]="note"></textarea>
        @if (error(); as e) { <p role="alert" class="text-sm text-red-600">{{ e }}</p> }
        <div class="flex justify-end">
          <button type="button" [class]="ui.primary" [disabled]="!canSave() || busy()" (click)="save()">{{ 'common.save' | transloco }}</button>
        </div>
      </div>
    </section>
  `,
})
export class SalesDocFormPage implements OnInit {
  private readonly api = inject(SalesService);
  private readonly products = inject(ProductsService);
  private readonly i18n = inject(TranslocoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly ui = UI;
  protected readonly kind = (this.route.snapshot.data['kind'] ?? 'quotation') as 'quotation' | 'order';
  private readonly editId = Number(this.route.snapshot.paramMap.get('id')) || null;
  protected readonly back = this.kind === 'quotation' ? '/sales/quotations' : '/sales/orders';
  protected readonly today = new Date().toISOString().slice(0, 10);

  protected readonly customer = signal<WholesaleCustomer | null>(null);
  protected readonly custHits = signal<WholesaleCustomer[]>([]);
  protected readonly prodHits = signal<Product[]>([]);
  protected readonly lines = signal<EditLine[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected validUntil = '';
  protected note = '';
  private timer: ReturnType<typeof setTimeout> | null = null;

  protected readonly total = computed(() => docTotal(this.lines()));
  protected readonly canSave = computed(() => !!this.customer() && this.lines().length > 0 && this.lines().every((l) => !lineProblem(l)));
  protected readonly title = computed(() =>
    this.editId ? 'salesDocs.quotations.edit' : this.kind === 'quotation' ? 'salesDocs.quotations.add' : 'salesDocs.orders.add',
  );

  async ngOnInit(): Promise<void> {
    if (!this.editId) return;
    try {
      const q = await firstValueFrom(this.api.quotation(this.editId));
      const c = await firstValueFrom(this.api.customer(q.customer.id));
      this.customer.set(c);
      this.validUntil = q.validUntil ?? '';
      this.note = q.note ?? '';
      const ls: EditLine[] = [];
      for (const l of q.lines) {
        const p = await firstValueFrom(this.api.price(c.id, l.productId));
        ls.push({ productId: l.productId, name: l.name, sku: l.sku, qty: l.qty, unitPrice: l.unitPrice,
          tierPrice: p.tierPrice ?? l.unitPrice, lowestPrice: p.lowestPrice ?? 0 });
      }
      this.lines.set(ls);
    } catch (e) {
      this.error.set(this.fail(e));
    }
  }

  protected fmt(n: number): string {
    return money(n);
  }

  protected problem(l: EditLine): string | null {
    return lineProblem(l);
  }

  private fail(e: unknown): string {
    return errorMessage(e, this.i18n.translate('errors.generic'));
  }

  private debounce(fn: () => Promise<void>): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void fn(), 250);
  }

  protected findCustomer(v: string): void {
    this.debounce(async () => {
      this.custHits.set(v.trim().length < 2 ? [] : (await firstValueFrom(this.api.customers({ search: v.trim() }))).slice(0, 8));
    });
  }

  protected pickCustomer(c: WholesaleCustomer): void {
    this.customer.set(c);
    this.custHits.set([]);
    void this.reprice();
  }

  protected clearCustomer(): void {
    this.customer.set(null);
  }

  /** Customer badle to tier price dobara. */
  private async reprice(): Promise<void> {
    const c = this.customer();
    if (!c || !this.lines().length) return;
    const ls: EditLine[] = [];
    for (const l of this.lines()) {
      const p = await firstValueFrom(this.api.price(c.id, l.productId));
      ls.push({ ...l, unitPrice: p.tierPrice ?? l.unitPrice, tierPrice: p.tierPrice ?? l.unitPrice, lowestPrice: p.lowestPrice ?? 0 });
    }
    this.lines.set(ls);
  }

  protected findProduct(v: string): void {
    this.debounce(async () => {
      this.prodHits.set(v.trim().length < 2 ? [] : (await firstValueFrom(this.products.list({ search: v.trim(), pageSize: 8 }))).data);
    });
  }

  protected async addProduct(p: Product): Promise<void> {
    this.prodHits.set([]);
    this.notice.set(null);
    const c = this.customer();
    if (!c) return;
    const i = this.lines().findIndex((l) => l.productId === p.id);
    if (i >= 0) {
      this.set(i, 'qty', this.lines()[i].qty + 1);
      return;
    }
    try {
      const pr = await firstValueFrom(this.api.price(c.id, p.id));
      if (pr.tierPrice === null) {
        this.notice.set(this.i18n.translate('posPage.noPrice'));
        return;
      }
      this.lines.update((ls) => [...ls, { productId: p.id, name: pr.name, sku: pr.sku, qty: 1, unitPrice: pr.tierPrice!,
        tierPrice: pr.tierPrice!, lowestPrice: pr.lowestPrice ?? 0 }]);
    } catch (e) {
      this.notice.set(this.fail(e));
    }
  }

  protected set(i: number, k: 'qty' | 'unitPrice', v: unknown): void {
    const n = k === 'qty' ? Math.max(1, Math.floor(+(v as number) || 1)) : Math.max(0, +(v as number) || 0);
    this.lines.update((ls) => ls.map((l, j) => (j === i ? { ...l, [k]: n } : l)));
  }

  protected remove(i: number): void {
    this.lines.update((ls) => ls.filter((_, j) => j !== i));
  }

  protected async save(): Promise<void> {
    const c = this.customer();
    if (!c || !this.canSave()) return;
    this.busy.set(true);
    this.error.set(null);
    const body = {
      customerId: c.id, note: this.note.trim() || null,
      lines: this.lines().map((l) => ({ productId: l.productId, qty: l.qty, unitPrice: l.unitPrice })),
    };
    try {
      if (this.kind === 'order') {
        const o = await firstValueFrom(this.api.createOrder(body));
        await this.router.navigate(['/sales/orders', o.id]);
      } else {
        const q = await firstValueFrom(this.api.saveQuotation({ ...body, validUntil: this.validUntil || null }, this.editId ?? undefined));
        await this.router.navigate(['/sales/quotations', q.id]);
      }
    } catch (e) {
      this.error.set(this.fail(e));
    } finally {
      this.busy.set(false);
    }
  }
}
