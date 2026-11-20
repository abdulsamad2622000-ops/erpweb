import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { ConfirmDialogService } from '../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { Product } from '../../products/models';
import { ProductsService } from '../../products/services/products.service';
import { formatMoney } from '../../products/utils/product-utils';
import { Warehouse } from '../../settings/models/org.models';
import { WarehousesService } from '../../settings/services/org.service';
import { PoAction, PoInput, PurchaseOrder, Supplier } from '../models/purchase.models';
import { PurchaseService } from '../services/purchase.service';
import { canDo, lineTotal, poTotal, remaining } from '../utils/purchase-utils';
import { PO_TONE, UI, errorMessage } from '../utils/ui';

@Component({
  selector: 'app-purchase-order-page',
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-3">
          <h1 class="text-xl font-semibold">{{ po()?.number ?? ('purchase.orders.add' | transloco) }}</h1>
          @if (po(); as o) { <app-status-badge [label]="'purchase.poStatus.' + o.status | transloco" [tone]="tone[o.status]" /> }
        </div>
        <a routerLink="/purchase/orders" [class]="ui.btn">{{ 'purchase.orders.back' | transloco }}</a>
        @if (po(); as o) {
          <a [routerLink]="['/purchase/orders', o.id, 'matching']" [class]="ui.btn">{{ 'purchase.payables.matching.link' | transloco }}</a>
        }
      </div>

      @if (po()?.approvalNote; as note) {
        <p class="rounded-lg border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">{{ 'purchase.orders.note' | transloco }}: {{ note }}</p>
      }
      @if (error(); as e) { <p role="alert" class="text-sm text-red-600">{{ e }}</p> }

      <div [formGroup]="form" [class]="ui.card + ' space-y-4'">
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label for="po-sup" class="mb-1 block text-sm">{{ 'purchase.orders.supplier' | transloco }} *</label>
            <select id="po-sup" formControlName="supplierId" [class]="ui.input">
              <option [ngValue]="0" disabled>—</option>
              @for (s of suppliers(); track s.id) { <option [ngValue]="s.id">{{ s.name }}</option> }
            </select>
          </div>
          <div>
            <label for="po-wh" class="mb-1 block text-sm">{{ 'purchase.orders.warehouse' | transloco }} *</label>
            <select id="po-wh" formControlName="warehouseId" [class]="ui.input">
              <option [ngValue]="0" disabled>—</option>
              @for (w of warehouses(); track w.id) { <option [ngValue]="w.id">{{ w.name }}</option> }
            </select>
          </div>
          <div>
            <label for="po-date" class="mb-1 block text-sm">{{ 'purchase.orders.date' | transloco }} *</label>
            <input id="po-date" type="date" formControlName="orderDate" [class]="ui.input" />
          </div>
          <div>
            <label for="po-exp" class="mb-1 block text-sm">{{ 'purchase.orders.expected' | transloco }}</label>
            <input id="po-exp" type="date" formControlName="expectedDate" [class]="ui.input" />
          </div>
        </div>
        <div>
          <label for="po-terms" class="mb-1 block text-sm">{{ 'purchase.orders.terms' | transloco }}</label>
          <input id="po-terms" formControlName="terms" [class]="ui.input" />
        </div>

        <div [class]="ui.tableWrap">
          <table class="w-full min-w-[46rem] text-start text-sm">
            <thead [class]="ui.thead"><tr>
              <th scope="col" [class]="ui.th">{{ 'purchase.orders.product' | transloco }}</th>
              <th scope="col" [class]="ui.th + ' w-28'">{{ 'purchase.orders.qty' | transloco }}</th>
              <th scope="col" [class]="ui.th + ' w-40'">{{ 'purchase.orders.unitCost' | transloco }}</th>
              <th scope="col" [class]="ui.th + ' text-end'">{{ 'purchase.orders.lineTotal' | transloco }}</th>
              @if (po()) { <th scope="col" [class]="ui.th">{{ 'purchase.orders.received' | transloco }}</th> }
              @if (editable()) { <th scope="col" class="w-12"><span class="sr-only">{{ 'common.actions' | transloco }}</span></th> }
            </tr></thead>
            <tbody formArrayName="lines">
              @for (g of lines.controls; track g; let i = $index) {
                <tr [class]="ui.tr" [formGroupName]="i">
                  <td [class]="ui.td">
                    <select formControlName="productId" [class]="ui.input" [attr.aria-label]="'purchase.orders.product' | transloco">
                      <option [ngValue]="0" disabled>—</option>
                      @for (p of products(); track p.id) { <option [ngValue]="p.id">{{ p.sku }} · {{ p.name }}</option> }
                    </select>
                  </td>
                  <td [class]="ui.td"><input type="number" min="1" step="1" formControlName="qty" [class]="ui.input" [attr.aria-label]="'purchase.orders.qty' | transloco" /></td>
                  <td [class]="ui.td"><input type="number" min="0" formControlName="unitCost" [class]="ui.input" [attr.aria-label]="'purchase.orders.unitCost' | transloco" /></td>
                  <td [class]="ui.td + ' text-end'">{{ money(lineTotalOf(i)) }}</td>
                  @if (po(); as o) { <td [class]="ui.td">{{ receivedOf(o, i) }}</td> }
                  @if (editable()) {
                    <td [class]="ui.td">
                      <button type="button" class="min-h-11 min-w-11 rounded-lg text-red-600" (click)="lines.removeAt(i)" [attr.aria-label]="'common.delete' | transloco">✕</button>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="flex flex-wrap items-center justify-between gap-3">
          @if (editable()) { <button type="button" [class]="ui.btn" (click)="addLine()">+ {{ 'purchase.orders.addLine' | transloco }}</button> } @else { <span></span> }
          <p class="text-base font-semibold">{{ 'purchase.orders.total' | transloco }}: Rs {{ money(total()) }}</p>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        @if (editable() && can('purchase.order.' + (po() ? 'edit' : 'create'))) {
          <button type="button" [class]="ui.btn" [disabled]="busy()" (click)="save(false)">{{ 'purchase.orders.saveDraft' | transloco }}</button>
          <button type="button" [class]="ui.primary" [disabled]="busy()" (click)="save(true)">{{ 'purchase.orders.submit' | transloco }}</button>
        }
        @if (allowed('approve') && can('purchase.order.approve')) {
          <button type="button" [class]="ui.primary" [disabled]="busy()" (click)="approve()">{{ 'purchase.orders.approve' | transloco }}</button>
          <button type="button" [class]="ui.danger" [disabled]="busy()" (click)="reject()">{{ 'purchase.orders.reject' | transloco }}</button>
        }
        @if (allowed('receive') && can('purchase.grn.create')) {
          <button type="button" [class]="ui.primary" [disabled]="busy()" (click)="receive()">{{ 'purchase.orders.receive' | transloco }}</button>
        }
        @if (allowed('cancel') && can('purchase.order.edit')) {
          <button type="button" [class]="ui.danger" [disabled]="busy()" (click)="cancel()">{{ 'purchase.orders.cancel' | transloco }}</button>
        }
      </div>
    </section>
  `,
})
export class PurchaseOrderPage implements OnInit {
  private readonly api = inject(PurchaseService);
  private readonly productsApi = inject(ProductsService);
  private readonly warehousesApi = inject(WarehousesService);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(ConfirmDialogService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly i18n = inject(TranslocoService);
  protected readonly ui = UI;
  protected readonly tone = PO_TONE;
  protected readonly money = formatMoney;

  protected readonly po = signal<PurchaseOrder | null>(null);
  protected readonly suppliers = signal<Supplier[]>([]);
  protected readonly warehouses = signal<Warehouse[]>([]);
  protected readonly products = signal<Product[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    supplierId: [0, Validators.min(1)],
    warehouseId: [0, Validators.min(1)],
    orderDate: [new Date().toISOString().slice(0, 10), Validators.required],
    expectedDate: [''],
    terms: [''],
    lines: this.fb.array([this.lineGroup()]),
  });
  protected get lines(): FormArray<ReturnType<PurchaseOrderPage['lineGroup']>> {
    return this.form.controls.lines;
  }
  private readonly formValue = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() });
  protected readonly total = computed(() => poTotal((this.formValue().lines ?? []).map((l) => ({ qty: +(l?.qty ?? 0), unitCost: +(l?.unitCost ?? 0) }))));
  protected readonly editable = computed(() => !this.po() || canDo(this.po()!.status, 'edit'));

  private lineGroup(l?: { productId: number; qty: number; unitCost: number }) {
    return this.fb.nonNullable.group({
      productId: [l?.productId ?? 0, Validators.min(1)],
      qty: [l?.qty ?? 1, [Validators.required, Validators.min(1)]],
      unitCost: [l?.unitCost ?? 0, [Validators.required, Validators.min(0)]],
    });
  }

  /** Product select hone par cost price khud bhar do (agar khali ho). */
  constructor() {
    this.form.controls.lines.valueChanges.subscribe(() => {
      this.lines.controls.forEach((g) => {
        const p = this.products().find((x) => x.id === g.controls.productId.value);
        if (p?.costPrice && !g.controls.unitCost.value) g.controls.unitCost.setValue(p.costPrice, { emitEvent: false });
      });
    });
  }

  async ngOnInit(): Promise<void> {
    try {
      const [s, w, p] = await Promise.all([
        firstValueFrom(this.api.suppliers()),
        firstValueFrom(this.warehousesApi.list({ pageSize: 500 })),
        firstValueFrom(this.productsApi.list({ pageSize: 1000 })),
      ]);
      this.suppliers.set(s.data.filter((x) => x.isActive));
      this.warehouses.set(w.data.filter((x) => x.isActive));
      this.products.set(p.data.filter((x) => x.isActive));
      const id = Number(this.route.snapshot.paramMap.get('id'));
      if (id) this.show(await firstValueFrom(this.api.order(id)));
    } catch {
      this.error.set(this.i18n.translate('errors.generic'));
    }
  }

  private show(o: PurchaseOrder): void {
    this.po.set(structuredClone(o));
    this.lines.clear();
    o.lines.forEach((l) => this.lines.push(this.lineGroup(l)));
    this.form.reset({ supplierId: o.supplierId, warehouseId: o.warehouseId, orderDate: o.orderDate, expectedDate: o.expectedDate ?? '', terms: o.terms });
    o.lines.forEach((l, i) => this.lines.at(i).reset({ productId: l.productId, qty: l.qty, unitCost: l.unitCost }));
    if (canDo(o.status, 'edit')) this.form.enable();
    else this.form.disable();
  }

  protected can(key: string): boolean {
    return this.auth.can(key);
  }

  protected allowed(a: PoAction): boolean {
    const o = this.po();
    return !!o && canDo(o.status, a);
  }

  protected addLine(): void {
    this.lines.push(this.lineGroup());
  }

  protected lineTotalOf(i: number): number {
    const l = this.formValue().lines?.[i];
    return lineTotal({ qty: +(l?.qty ?? 0), unitCost: +(l?.unitCost ?? 0) });
  }

  protected receivedOf(o: PurchaseOrder, i: number): string {
    const l = o.lines[i];
    return l ? `${l.receivedQty} / ${l.qty}${remaining(l) ? '' : ' ✓'}` : '';
  }

  protected async save(submit: boolean): Promise<void> {
    this.form.markAllAsTouched();
    this.error.set(null);
    if (this.form.invalid || this.lines.length === 0) {
      this.error.set(this.i18n.translate('purchase.orders.fixForm'));
      return;
    }
    const v = this.form.getRawValue();
    const body: PoInput = {
      supplierId: v.supplierId, warehouseId: v.warehouseId, orderDate: v.orderDate, expectedDate: v.expectedDate || null, terms: v.terms,
      lines: v.lines.map((l) => ({ productId: +l.productId, qty: +l.qty, unitCost: +l.unitCost })),
    };
    await this.run(async () => {
      const cur = this.po();
      let o = await firstValueFrom(cur ? this.api.updateOrder(cur.id, body) : this.api.createOrder(body));
      if (submit) o = await firstValueFrom(this.api.orderAction(o.id, 'submit'));
      if (!cur) await this.router.navigate(['/purchase/orders', o.id], { replaceUrl: true });
      this.show(o);
    });
  }

  protected async approve(): Promise<void> {
    const res = await this.dialogs.approve({
      title: this.i18n.translate('purchase.orders.approveTitle', { number: this.po()?.number }),
      message: this.i18n.translate('purchase.orders.approveMessage', { total: formatMoney(this.total()) }),
      confirmLabel: this.i18n.translate('purchase.orders.approve'),
      cancelLabel: this.i18n.translate('common.cancel'),
    });
    if (res) await this.act('approve', res.note);
  }

  protected async reject(): Promise<void> {
    const reason = await this.dialogs.reason({
      title: this.i18n.translate('purchase.orders.rejectTitle'),
      message: this.i18n.translate('purchase.orders.rejectMessage'),
      confirmLabel: this.i18n.translate('purchase.orders.reject'),
      cancelLabel: this.i18n.translate('common.cancel'),
      danger: true,
    });
    if (reason) await this.act('reject', reason);
  }

  protected async cancel(): Promise<void> {
    const yes = await this.dialogs.confirm({
      title: this.i18n.translate('purchase.orders.cancelTitle'),
      message: this.i18n.translate('purchase.orders.cancelMessage'),
      confirmLabel: this.i18n.translate('purchase.orders.cancel'),
      cancelLabel: this.i18n.translate('common.cancel'),
      danger: true,
    });
    if (yes) await this.act('cancel', null);
  }

  protected async receive(): Promise<void> {
    const o = this.po();
    if (!o) return;
    await this.run(async () => {
      const g = await firstValueFrom(this.api.createGrn(o.id));
      await this.router.navigate(['/purchase/grn', g.id]);
    });
  }

  private async act(action: string, note: string | null): Promise<void> {
    const o = this.po();
    if (!o) return;
    await this.run(async () => this.show(await firstValueFrom(this.api.orderAction(o.id, action, note))));
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await fn();
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('errors.generic')));
    } finally {
      this.busy.set(false);
    }
  }
}
