import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { HasPermissionDirective } from '../../../core/auth/has-permission.directive';
import { SendEmailComponent } from '../../email/ui/send-email.component';
import { PrintService } from '../../../shared/ui/print/print.service';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { PAY_METHODS, PayMethod } from '../../pos/models/pos.models';
import { money } from '../../pos/utils/pos-utils';
import { UI, errorMessage } from '../../purchase/utils/ui';
import { newKey } from '../../sales/utils/sales-print';
import { JobStatus, RepairJob, RepairPart } from '../models/repair.models';
import { RepairsService } from '../services/repairs.service';
import { JOB_TONE, WARRANTY_TONE, isOpen, jobSlipHtml, jobTotal } from '../utils/repair-utils';

/** Job card detail: status aage, diagnosis/parts/charges, delivery, slip print. */
@Component({
  selector: 'app-repair-job-page',
  imports: [FormsModule, RouterLink, TranslocoPipe, HasPermissionDirective, StatusBadgeComponent, SendEmailComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-5xl space-y-4">
      @if (error(); as e) { <p role="alert" class="text-sm text-red-600">{{ e }}</p> }
      @if (j(); as j) {
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h1 class="text-xl font-semibold">{{ j.number }}
            <app-status-badge [label]="'repairsPage.status.' + j.status | transloco" [tone]="tone[j.status]" />
            <app-status-badge [label]="'repairsPage.w.' + j.warranty | transloco" [tone]="wTone[j.warranty]" /></h1>
          <div class="flex flex-wrap gap-2">
            <a routerLink="/warranty" [class]="ui.btn">{{ 'salesDocs.back' | transloco }}</a>
            <button type="button" [class]="ui.btn" (click)="print(j)">{{ 'repairsPage.printSlip' | transloco }}</button>
            @if (j.status === 'ready') { <app-send-email *hasPermission="'email.message.send'" kind="repair" [refId]="j.id" /> }
          </div>
        </div>

        <div [class]="ui.card + ' grid gap-2 text-sm sm:grid-cols-3'">
          <div><span class="text-slate-600 dark:text-slate-400">{{ 'salesDocs.customer' | transloco }}</span><br /><b>{{ j.customerName }}</b> <span dir="ltr">{{ j.customerPhone }}</span></div>
          <div><span class="text-slate-600 dark:text-slate-400">{{ 'repairsPage.device' | transloco }}</span><br />{{ j.device }}
            @if (j.serial) { · <code dir="ltr">{{ j.serial }}</code> }</div>
          <div><span class="text-slate-600 dark:text-slate-400">{{ 'repairsPage.warranty' | transloco }}</span><br />
            {{ j.saleNumber ?? '—' }} @if (j.warrantyUntil) { · {{ 'repairsPage.until' | transloco: { date: j.warrantyUntil } }} }</div>
          <div class="sm:col-span-2"><span class="text-slate-600 dark:text-slate-400">{{ 'repairsPage.problem' | transloco }}</span><br />{{ j.problem }}</div>
          <div><span class="text-slate-600 dark:text-slate-400">{{ 'repairsPage.accessories' | transloco }}</span><br />{{ j.accessories || '—' }}</div>
        </div>

        @if (open(j)) {
          <div *hasPermission="'warranty.claim.edit'" [class]="ui.card + ' space-y-2'">
            <h2 class="font-semibold">{{ 'repairsPage.moveTo' | transloco }}</h2>
            <div class="flex flex-wrap items-end gap-2">
              @for (s of j.next; track s) {
                <button type="button" [class]="s === 'cancelled' ? ui.danger : ui.btn" [disabled]="busy()" (click)="move(s)">{{ 'repairsPage.status.' + s | transloco }}</button>
              }
              <label class="min-w-64 flex-1 text-sm font-medium">{{ 'repairsPage.statusNote' | transloco }}
                <input placeholder="Type here..." [class]="ui.input + ' mt-1'" [(ngModel)]="note" /></label>
            </div>
          </div>
        }

        <div [class]="ui.card + ' space-y-3'">
          <h2 class="font-semibold">{{ 'repairsPage.work' | transloco }}</h2>
          <label class="block text-sm font-medium">{{ 'repairsPage.diagnosis' | transloco }}
            <textarea placeholder="Type here..." rows="2" [class]="ui.input + ' mt-1 py-2'" [disabled]="!open(j)" [(ngModel)]="diagnosis"></textarea></label>
          <table class="w-full text-sm">
            <thead [class]="ui.thead"><tr>
              <th scope="col" [class]="ui.th">{{ 'repairsPage.part' | transloco }}</th>
              <th scope="col" [class]="ui.th">{{ 'repairsPage.partSerial' | transloco }}</th>
              <th scope="col" [class]="ui.th">{{ 'posPage.qty' | transloco }}</th>
              <th scope="col" [class]="ui.th">{{ 'posPage.price' | transloco }}</th>
              <th scope="col" [class]="ui.th + ' text-end'">{{ 'posPage.amount' | transloco }}</th>
              <th scope="col" [class]="ui.th"><span class="sr-only">{{ 'posPage.remove' | transloco }}</span></th>
            </tr></thead>
            <tbody>
              @for (p of parts(); track $index; let i = $index) {
                <tr [class]="ui.tr">
                  <td [class]="ui.td"><input placeholder="Type here..." class="min-h-9 w-full rounded border border-slate-400 bg-transparent px-2" [disabled]="!open(j)"
                    [attr.aria-label]="'repairsPage.part' | transloco" [ngModel]="p.description" (ngModelChange)="setPart(i, 'description', $event)" /></td>
                  <td [class]="ui.td"><input class="min-h-9 w-32 rounded border border-slate-400 bg-transparent px-2" dir="ltr" [disabled]="!open(j)"
                    [attr.aria-label]="'repairsPage.partSerial' | transloco" [placeholder]="'repairsPage.partSerialHint' | transloco"
                    [ngModel]="p.serial ?? ''" (ngModelChange)="setPart(i, 'serial', $event)" /></td>
                  <td [class]="ui.td"><input placeholder="Type here..." type="number" min="1" class="min-h-9 w-20 rounded border border-slate-400 bg-transparent px-2" [disabled]="!open(j) || !!p.serial"
                    [attr.aria-label]="'posPage.qty' | transloco" [ngModel]="p.qty" (ngModelChange)="setPart(i, 'qty', $event)" /></td>
                  <td [class]="ui.td"><input placeholder="Type here..." type="number" min="0" class="min-h-9 w-28 rounded border border-slate-400 bg-transparent px-2" [disabled]="!open(j)"
                    [attr.aria-label]="'posPage.price' | transloco" [ngModel]="p.unitPrice" (ngModelChange)="setPart(i, 'unitPrice', $event)" /></td>
                  <td [class]="ui.td + ' text-end'">{{ fmt(p.qty * p.unitPrice) }}</td>
                  <td [class]="ui.td">@if (open(j)) {
                    <button type="button" class="inline-flex min-h-11 min-w-11 items-center justify-center text-red-600"
                      [attr.aria-label]="'posPage.remove' | transloco" (click)="removePart(i)"><i class="pi pi-trash" aria-hidden="true"></i></button> }</td>
                </tr>
              }
            </tbody>
          </table>
          @if (open(j)) { <button type="button" [class]="ui.btn" (click)="addPart()">+ {{ 'repairsPage.addPart' | transloco }}</button> }
          <div class="flex flex-wrap items-end justify-between gap-2">
            <div class="flex flex-wrap gap-2">
              <label class="text-sm font-medium">{{ 'repairsPage.labour' | transloco }}
                <input placeholder="Type here..." type="number" min="0" [class]="ui.input + ' mt-1 w-36'" [disabled]="!open(j)" [ngModel]="labour()" (ngModelChange)="labour.set(+$event || 0)" /></label>
              <label class="text-sm font-medium">{{ 'repairsPage.promised' | transloco }}
                <input type="date" [class]="ui.input + ' mt-1'" [disabled]="!open(j)" [(ngModel)]="promisedOn" /></label>
            </div>
            <div class="text-base font-semibold">{{ 'repairsPage.charges' | transloco }}: {{ fmt(total()) }}</div>
          </div>
          @if (j.warranty === 'in_warranty') { <p class="text-xs text-slate-600 dark:text-slate-400">{{ 'repairsPage.warrantyHint' | transloco }}</p> }
          @if (open(j)) {
            <div *hasPermission="'warranty.claim.edit'" class="flex justify-end">
              <button type="button" [class]="ui.primary" [disabled]="busy() || !partsValid()" (click)="saveWork()">{{ 'common.save' | transloco }}</button>
            </div>
          }
        </div>

        @if (j.status === 'ready') {
          <div *hasPermission="'warranty.claim.edit'" [class]="ui.card + ' space-y-2'">
            <h2 class="font-semibold">{{ 'repairsPage.deliver' | transloco }}</h2>
            @if (dirty()) { <p class="text-sm text-amber-700">{{ 'repairsPage.saveFirst' | transloco }}</p> }
            <div class="flex flex-wrap items-end gap-2">
              <span class="text-sm">{{ 'repairsPage.collect' | transloco: { n: fmt(j.total) } }}</span>
              @if (j.total > 0) {
                <select [class]="ui.input + ' w-40'" [attr.aria-label]="'posPage.payment' | transloco" [(ngModel)]="method">
                  @for (m of methods; track m) { <option [ngValue]="m">{{ 'posPage.methods.' + m | transloco }}</option> }
                </select>
              }
              <button type="button" [class]="ui.primary" [disabled]="busy() || dirty()" (click)="deliver(j)">{{ 'repairsPage.deliverBtn' | transloco }}</button>
            </div>
          </div>
        }
        @if (j.status === 'delivered') {
          <p role="status" class="rounded-xl border border-green-600 p-3 text-sm">
            {{ 'repairsPage.deliveredOn' | transloco: { date: (j.deliveredAt ?? '').slice(0, 10), n: fmt(j.paid) } }}
            @if (j.paidMethod) { · {{ 'posPage.methods.' + j.paidMethod | transloco }} }</p>
        }

        <div [class]="ui.card">
          <h2 class="mb-2 font-semibold">{{ 'repairsPage.history' | transloco }}</h2>
          <ol class="space-y-1 text-sm">
            @for (e of j.events; track $index) {
              <li>{{ e.at.slice(0, 16).replace('T', ' ') }} · <b>{{ 'repairsPage.status.' + e.status | transloco }}</b> · {{ e.by }}
                @if (e.note) { · {{ e.note }} }</li>
            }
          </ol>
        </div>
      }
    </section>
  `,
})
export class RepairJobPage implements OnInit {
  private readonly api = inject(RepairsService);
  private readonly i18n = inject(TranslocoService);
  private readonly route = inject(ActivatedRoute);
  private readonly printer = inject(PrintService);
  protected readonly ui = UI;
  protected readonly tone = JOB_TONE;
  protected readonly wTone = WARRANTY_TONE;
  protected readonly methods = PAY_METHODS;
  private readonly id = Number(this.route.snapshot.paramMap.get('id'));
  protected readonly j = signal<RepairJob | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected readonly parts = signal<RepairPart[]>([]);
  protected readonly labour = signal(0);
  protected diagnosis = '';
  protected promisedOn = '';
  protected note = '';
  protected method: PayMethod = 'cash';
  private key = newKey();

  protected readonly total = computed(() => jobTotal(this.parts(), this.labour()));
  protected readonly partsValid = computed(() => this.parts().every((p) => p.description.trim() && p.qty >= 1 && p.unitPrice >= 0));
  protected readonly dirty = computed(() => {
    const j = this.j();
    return !!j && Math.abs(this.total() - j.total) > 0.004;
  });

  async ngOnInit(): Promise<void> {
    await this.run(async () => {
      const j = await firstValueFrom(this.api.get(this.id));
      this.set(j);
      if (this.route.snapshot.queryParamMap.get('print')) this.print(j);
    });
  }

  protected fmt(n: number): string {
    return money(n);
  }

  protected open(j: RepairJob): boolean {
    return isOpen(j.status);
  }

  private set(j: RepairJob): void {
    this.j.set(j);
    this.parts.set(j.parts.map((p) => ({ ...p })));
    this.labour.set(j.labour);
    this.diagnosis = j.diagnosis ?? '';
    this.promisedOn = j.promisedOn ?? '';
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    try {
      await fn();
      this.error.set(null);
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('errors.generic')));
    } finally {
      this.busy.set(false);
    }
  }

  protected addPart(): void {
    this.parts.update((p) => [...p, { description: '', qty: 1, unitPrice: 0 }]);
  }

  protected removePart(i: number): void {
    this.parts.update((p) => p.filter((_, j) => j !== i));
  }

  protected setPart(i: number, k: keyof RepairPart, v: unknown): void {
    if (k === 'serial') {
      const sn = String(v ?? '').trim().toUpperCase();
      this.parts.update((p) => p.map((x, j) => (j === i ? { ...x, serial: sn || null, qty: sn ? 1 : x.qty } : x)));
      return;
    }
    const val = k === 'description' ? String(v) : k === 'qty' ? Math.max(1, Math.floor(+(v as number) || 1)) : Math.max(0, +(v as number) || 0);
    this.parts.update((p) => p.map((x, j) => (j === i ? { ...x, [k]: val } : x)));
  }

  protected async saveWork(): Promise<void> {
    await this.run(async () => this.set(await firstValueFrom(this.api.update(this.id, {
      diagnosis: this.diagnosis.trim() || null, labour: this.labour(), promisedOn: this.promisedOn || null,
      parts: this.parts().map((p) => ({ description: p.description.trim(), qty: p.qty, unitPrice: p.unitPrice, serial: p.serial ?? null })),
    }))));
  }

  protected async move(s: JobStatus): Promise<void> {
    await this.run(async () => {
      this.set(await firstValueFrom(this.api.move(this.id, s, this.note.trim() || null)));
      this.note = '';
    });
  }

  protected async deliver(j: RepairJob): Promise<void> {
    await this.run(async () => {
      this.set(await firstValueFrom(this.api.deliver(this.id, j.total, j.total > 0 ? this.method : null, this.key)));
      this.key = newKey();
    });
  }

  protected print(j: RepairJob): void {
    const t = (k: string, p?: Record<string, unknown>): string => this.i18n.translate(k, p);
    const wl = t(`repairsPage.w.${j.warranty}`) + (j.warrantyUntil ? ` (${t('repairsPage.until', { date: j.warrantyUntil })})` : '');
    void this.printer.print({
      title: j.number,
      paper: 'a4',
      body: jobSlipHtml({ ...j, warrantyLabel: wl }, {
        title: t('repairsPage.slipTitle'), customer: t('salesDocs.customer'), device: t('repairsPage.device'), serial: t('salesDocs.serial'),
        problem: t('repairsPage.problem'), accessories: t('repairsPage.accessories'), warranty: t('repairsPage.warranty'),
        promised: t('repairsPage.promised'), estimate: t('repairsPage.estimate'), terms: t('repairsPage.terms'),
      }),
    });
  }
}
