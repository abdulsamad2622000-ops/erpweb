import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { HasPermissionDirective } from '../../../core/auth/has-permission.directive';
import { ConfirmDialogService } from '../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { PrintService } from '../../../shared/ui/print/print.service';
import { ScanEvent, ScanInputComponent } from '../../../shared/ui/scan-input/scan-input.component';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { normalizeSerial } from '../../purchase/utils/purchase-utils';
import { money } from '../../pos/utils/pos-utils';
import { UI, errorMessage } from '../../purchase/utils/ui';
import { Warehouse } from '../../settings/models/org.models';
import { WarehousesService } from '../../settings/services/org.service';
import { OrderLine, SalesOrder } from '../models/sales.models';
import { SalesService } from '../services/sales.service';
import { newKey, printDoc } from '../utils/sales-print';
import { ORDER_TONE, leftToDeliver } from '../utils/sales-utils';

/** Sales order: detail, cancel, aur delivery (serials scan kar ke challan). */
@Component({
  selector: 'app-sales-order-page',
  imports: [FormsModule, RouterLink, TranslocoPipe, HasPermissionDirective, StatusBadgeComponent, ScanInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-5xl space-y-4">
      @if (error(); as e) { <p role="alert" class="text-sm text-red-600">{{ e }}</p> }
      @if (o(); as o) {
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h1 class="text-xl font-semibold">{{ 'salesDocs.order' | transloco }} {{ o.number }}
            <app-status-badge [label]="'salesDocs.status.order.' + o.status | transloco" [tone]="tone[o.status]" /></h1>
          <div class="flex flex-wrap gap-2">
            <a routerLink="/sales/orders" [class]="ui.btn">{{ 'salesDocs.back' | transloco }}</a>
            <button type="button" [class]="ui.btn" (click)="print(o)">{{ 'salesDocs.print' | transloco }}</button>
            @if (o.status === 'open') {
              <button *hasPermission="'sales.order.edit'" type="button" [class]="ui.danger" [disabled]="busy()" (click)="cancel()">{{ 'salesDocs.cancel' | transloco }}</button>
            }
            @if ((o.status === 'open' || o.status === 'partial') && !delivering()) {
              <button *hasPermission="'sales.challan.create'" type="button" [class]="ui.primary" (click)="startDelivery()">{{ 'salesDocs.deliver' | transloco }}</button>
            }
          </div>
        </div>
        <div [class]="ui.card + ' grid gap-2 text-sm sm:grid-cols-3'">
          <div><span class="text-slate-600 dark:text-slate-400">{{ 'salesDocs.customer' | transloco }}</span><br /><b>{{ o.customer.name }}</b> <span dir="ltr">{{ o.customer.phone }}</span></div>
          <div><span class="text-slate-600 dark:text-slate-400">{{ 'salesDocs.fromQuotation' | transloco }}</span><br />{{ o.quotationNumber ?? '—' }}</div>
          <div><span class="text-slate-600 dark:text-slate-400">{{ 'salesDocs.createdBy' | transloco }}</span><br />{{ o.createdBy }} · {{ o.createdAt.slice(0, 10) }}</div>
        </div>

        @if (delivering()) {
          <div [class]="ui.card + ' space-y-3'">
            <h2 class="font-semibold">{{ 'salesDocs.newChallan' | transloco }}</h2>
            <div class="grid gap-3 md:grid-cols-2">
              <div>
                <label for="dl-wh" class="mb-1 block text-sm font-medium">{{ 'salesDocs.fromWarehouse' | transloco }}</label>
                <select id="dl-wh" [class]="ui.input" [(ngModel)]="warehouseId">
                  <option [ngValue]="0">{{ 'posPage.pickCounter' | transloco }}</option>
                  @for (w of warehouses(); track w.id) { <option [ngValue]="w.id">{{ w.name }}</option> }
                </select>
              </div>
              <div>
                <label for="dl-scan" class="mb-1 block text-sm font-medium">{{ 'salesDocs.scanSerial' | transloco }}</label>
                <app-scan-input inputId="dl-scan" [placeholder]="'salesReturnPage.findHint' | transloco" (scanned)="onScan($event)" />
              </div>
            </div>
            @if (notice(); as n) { <p role="alert" class="text-sm text-red-600">{{ n }}</p> }
          </div>
        }

        <div [class]="ui.tableWrap">
          <table class="w-full text-sm">
            <thead [class]="ui.thead"><tr>
              <th scope="col" [class]="ui.th">{{ 'posPage.item' | transloco }}</th>
              <th scope="col" [class]="ui.th + ' text-end'">{{ 'posPage.qty' | transloco }}</th>
              <th scope="col" [class]="ui.th + ' text-end'">{{ 'salesDocs.delivered' | transloco }}</th>
              <th scope="col" [class]="ui.th + ' text-end'">{{ 'posPage.price' | transloco }}</th>
              @if (delivering()) { <th scope="col" [class]="ui.th">{{ 'salesDocs.thisChallan' | transloco }}</th> }
            </tr></thead>
            <tbody>
              @for (l of o.lines; track l.id) {
                <tr [class]="ui.tr">
                  <td [class]="ui.td">{{ l.name }} <span class="text-xs text-slate-500" dir="ltr">{{ l.sku }}</span></td>
                  <td [class]="ui.td + ' text-end'">{{ l.qty }}</td>
                  <td [class]="ui.td + ' text-end'">{{ l.deliveredQty }}</td>
                  <td [class]="ui.td + ' text-end'">{{ fmt(l.unitPrice) }}</td>
                  @if (delivering()) {
                    <td [class]="ui.td">
                      @if (left(l) === 0) {
                        <span class="text-slate-500">{{ 'salesDocs.done' | transloco }}</span>
                      } @else if (l.serialized) {
                        <div class="flex flex-wrap gap-1">
                          @for (s of picks()[l.id] ?? []; track s) {
                            <button type="button" class="min-h-9 rounded border border-slate-300 px-2 text-xs dark:border-slate-600"
                              [attr.aria-label]="('posPage.remove' | transloco) + ' ' + s" (click)="unpick(l.id, s)"><code dir="ltr">{{ s }}</code> ✕</button>
                          }
                          <span class="text-xs text-slate-600 dark:text-slate-400">{{ (picks()[l.id] ?? []).length }} / {{ left(l) }}</span>
                        </div>
                      } @else {
                        <input type="number" min="0" [max]="left(l)" class="min-h-9 w-24 rounded border border-slate-400 bg-transparent px-2"
                          [attr.aria-label]="('salesDocs.thisChallan' | transloco) + ' ' + l.name" [ngModel]="qtys()[l.id] ?? 0" (ngModelChange)="setQty(l, $event)" />
                      }
                    </td>
                  }
                </tr>
              }
            </tbody>
            <tfoot><tr><td colspan="3" class="px-3 py-2 text-end font-semibold">{{ 'posPage.total' | transloco }}</td>
              <td class="px-3 py-2 text-end font-semibold">{{ fmt(o.total) }}</td>@if (delivering()) { <td></td> }</tr></tfoot>
          </table>
        </div>

        @if (delivering()) {
          <div [class]="ui.card + ' space-y-2'">
            <label for="dl-note" class="block text-sm font-medium">{{ 'salesDocs.note' | transloco }}</label>
            <input id="dl-note" [class]="ui.input" [(ngModel)]="note" />
            <div class="flex justify-end gap-2">
              <button type="button" [class]="ui.btn" (click)="delivering.set(false)">{{ 'common.cancel' | transloco }}</button>
              <button type="button" [class]="ui.primary" [disabled]="!pickedCount() || !warehouseId || busy()" (click)="createChallan(o)">
                {{ 'salesDocs.createChallan' | transloco: { n: pickedCount() } }}
              </button>
            </div>
          </div>
        }

        @if (o.challans.length) {
          <div [class]="ui.card">
            <h2 class="mb-2 font-semibold">{{ 'salesDocs.challans.title' | transloco }}</h2>
            <ul class="space-y-1 text-sm">
              @for (c of o.challans; track c.id) {
                <li><a [routerLink]="['/sales/challans', c.id]" class="text-[#1E3A8A] underline dark:text-sky-300">{{ c.number }}</a>
                  · {{ c.createdAt.slice(0, 10) }} · {{ (c.invoiced ? 'salesDocs.status.challan.invoiced' : 'salesDocs.status.challan.pending') | transloco }}</li>
              }
            </ul>
          </div>
        }
      }
    </section>
  `,
})
export class SalesOrderPage implements OnInit {
  private readonly api = inject(SalesService);
  private readonly whApi = inject(WarehousesService);
  private readonly i18n = inject(TranslocoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly dialogs = inject(ConfirmDialogService);
  private readonly printer = inject(PrintService);
  protected readonly ui = UI;
  protected readonly tone = ORDER_TONE;
  private readonly id = Number(this.route.snapshot.paramMap.get('id'));
  protected readonly o = signal<SalesOrder | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly delivering = signal(false);
  protected readonly warehouses = signal<Warehouse[]>([]);
  protected readonly picks = signal<Record<number, string[]>>({});
  protected readonly qtys = signal<Record<number, number>>({});
  protected warehouseId = 0;
  protected note = '';
  private key = newKey();

  protected readonly pickedCount = computed(
    () => Object.values(this.picks()).reduce((a, s) => a + s.length, 0) + Object.values(this.qtys()).reduce((a, n) => a + (n || 0), 0),
  );

  async ngOnInit(): Promise<void> {
    try {
      this.o.set(await firstValueFrom(this.api.order(this.id)));
    } catch (e) {
      this.error.set(this.fail(e));
    }
  }

  protected fmt(n: number): string {
    return money(n);
  }

  protected left(l: OrderLine): number {
    return leftToDeliver(l);
  }

  private fail(e: unknown): string {
    return errorMessage(e, this.i18n.translate('errors.generic'));
  }

  protected async startDelivery(): Promise<void> {
    this.delivering.set(true);
    this.picks.set({});
    this.qtys.set({});
    this.key = newKey();
    if (!this.warehouses().length) {
      try {
        const ws = (await firstValueFrom(this.whApi.list({ pageSize: 500 }))).data.filter((w) => w.isActive);
        this.warehouses.set(ws);
        if (ws.length === 1) this.warehouseId = ws[0].id;
      } catch (e) {
        this.notice.set(this.fail(e));
      }
    }
  }

  /** Scan kiya serial pehli matching line par jata hai jahan jagah ho. Product backend challan par check karta hai. */
  protected onScan(e: ScanEvent): void {
    const o = this.o();
    if (!o) return;
    const sn = normalizeSerial(e.value);
    this.notice.set(null);
    if (Object.values(this.picks()).some((s) => s.includes(sn))) {
      this.notice.set(this.i18n.translate('posPage.alreadyInCart'));
      return;
    }
    const open = o.lines.filter((l) => l.serialized && (this.picks()[l.id] ?? []).length < this.left(l));
    if (!open.length) {
      this.notice.set(this.i18n.translate('salesDocs.nothingLeft'));
      return;
    }
    // Ek se zyada serialized model baqi hon to pehla; galat model ho to challan banate waqt backend batata hai.
    const line = open[0];
    this.picks.update((p) => ({ ...p, [line.id]: [...(p[line.id] ?? []), sn] }));
  }

  protected unpick(lineId: number, sn: string): void {
    this.picks.update((p) => ({ ...p, [lineId]: (p[lineId] ?? []).filter((x) => x !== sn) }));
  }

  protected setQty(l: OrderLine, v: unknown): void {
    const n = Math.min(Math.max(0, Math.floor(+(v as number) || 0)), this.left(l));
    this.qtys.update((q) => ({ ...q, [l.id]: n }));
  }

  protected async createChallan(o: SalesOrder): Promise<void> {
    this.busy.set(true);
    this.notice.set(null);
    try {
      const lines = o.lines
        .map((l): { orderLineId: number; serials?: string[]; qty?: number } =>
          l.serialized ? { orderLineId: l.id, serials: this.picks()[l.id] ?? [] } : { orderLineId: l.id, qty: this.qtys()[l.id] ?? 0 })
        .filter((l) => (l.serials ? l.serials.length > 0 : (l.qty ?? 0) > 0));
      const c = await firstValueFrom(this.api.createChallan({ orderId: o.id, warehouseId: this.warehouseId, lines, note: this.note.trim() || null }, this.key));
      await this.router.navigate(['/sales/challans', c.id]);
    } catch (e) {
      this.notice.set(this.fail(e));
    } finally {
      this.busy.set(false);
    }
  }

  protected async cancel(): Promise<void> {
    const ok = await this.dialogs.confirm({ title: this.i18n.translate('salesDocs.cancel'), message: this.i18n.translate('salesDocs.cancelOrderMsg'), danger: true });
    if (!ok) return;
    try {
      this.o.set(await firstValueFrom(this.api.cancelOrder(this.id)));
    } catch (e) {
      this.error.set(this.fail(e));
    }
  }

  protected print(o: SalesOrder): void {
    printDoc(this.printer, this.i18n, {
      titleKey: 'salesDocs.order', number: o.number, date: o.createdAt.slice(0, 10), total: o.total,
      party: `${o.customer.name} ${o.customer.phone}`,
      rows: o.lines.map((l) => ({ name: l.name, detail: l.sku, qty: l.qty, price: l.unitPrice })),
    });
  }
}
