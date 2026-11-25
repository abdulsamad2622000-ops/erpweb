import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { ConfirmDialogService } from '../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { ScanInputComponent } from '../../../shared/ui/scan-input/scan-input.component';
import { ScanSoundService } from '../../../shared/ui/scan-input/scan-sound.service';
import { StatusBadgeComponent } from '../../../shared/ui/status-badge/status-badge.component';
import { Grn, GrnLine, InspectionStatus } from '../models/purchase.models';
import { PurchaseService } from '../services/purchase.service';
import { grnLineQty, grnProgress, isSerialFormatOk, normalizeSerial, parseSerialList } from '../utils/purchase-utils';
import { INSPECTION_TONE, UI, errorMessage } from '../utils/ui';

interface Feedback {
  id: number;
  ok: boolean;
  serial: string;
  text: string;
}

const FEEDBACK_MAX = 8;

@Component({
  selector: 'app-grn-receive-page',
  imports: [FormsModule, RouterLink, TranslocoPipe, ScanInputComponent, StatusBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (grn(); as g) {
      <section class="mx-auto max-w-6xl space-y-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="flex flex-wrap items-center gap-3">
              <h1 class="text-xl font-semibold">{{ g.number }} · {{ 'purchase.grn.receive' | transloco }}</h1>
              <app-status-badge [label]="'purchase.grn.status.' + g.status | transloco" [tone]="posted() ? 'success' : 'warning'" />
            </div>
            <p class="text-sm text-slate-600 dark:text-slate-400">
              <a [routerLink]="['/purchase/orders', g.poId]" class="underline">{{ g.poNumber }}</a> · {{ 'purchase.orders.supplier' | transloco }}: {{ g.supplierName }}
            </p>
          </div>
          <div class="flex flex-wrap gap-2">
            @if (posted()) {
              <a [routerLink]="['/products/barcodes']" [queryParams]="{ grn: g.number }" [class]="ui.primary">{{ 'purchase.grn.printLabels' | transloco }}</a>
              <a [routerLink]="['/purchase/grn', g.id, 'landed-cost']" [class]="ui.btn">{{ 'purchase.payables.landed.link' | transloco }}</a>
            } @else if (canEdit()) {
              <button type="button" [class]="ui.btn" [disabled]="busy()" (click)="saveDraft()">{{ 'purchase.grn.saveDraft' | transloco }}</button>
              <button type="button" [class]="ui.primary" [disabled]="busy() || progress().done === 0" (click)="post()">{{ 'purchase.grn.post' | transloco }}</button>
            }
          </div>
        </div>

        @if (error(); as e) { <p role="alert" class="rounded-lg border border-red-600 p-3 text-sm text-red-600">{{ e }}</p> }
        @if (notice(); as n) { <p role="status" class="rounded-lg border border-green-600 p-3 text-sm text-green-700">{{ n }}</p> }

        <div [class]="ui.card">
          <div class="mb-1 flex justify-between text-sm">
            <span>{{ 'purchase.grn.progress' | transloco: { done: progress().done, expected: progress().expected } }}</span>
            <span>{{ pct() }}%</span>
          </div>
          <div class="h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar"
               [attr.aria-valuenow]="progress().done" aria-valuemin="0" [attr.aria-valuemax]="progress().expected">
            <div class="h-full rounded-full bg-[#00BCD4] transition-all" [style.width.%]="pct()"></div>
          </div>
        </div>

        <div class="grid gap-4 lg:grid-cols-[18rem_1fr]">
          <nav class="space-y-2" [attr.aria-label]="'purchase.grn.lines' | transloco">
            @for (l of lines(); track l.productId; let i = $index) {
              <button type="button" class="min-h-11 w-full rounded-lg border px-3 py-2 text-start text-sm"
                      [class]="active() === i ? 'border-[#1E3A8A] bg-blue-50 dark:bg-slate-800' : 'border-slate-300'"
                      [attr.aria-pressed]="active() === i" (click)="active.set(i)">
                <span class="block font-medium">{{ l.name }}</span>
                <span class="text-xs text-slate-500">{{ l.sku }} · {{ qty(l) }} / {{ left(l) }}{{ qty(l) >= left(l) ? ' ✓' : '' }}</span>
              </button>
            }
          </nav>

          @if (line(); as l) {
            <div class="space-y-4">
              @if (l.serialized) {
                @if (!posted() && canEdit()) {
                  <div [class]="ui.card + ' space-y-3'">
                    <label for="grn-scan" class="block text-sm font-medium">{{ 'purchase.grn.scan' | transloco }}</label>
                    <app-scan-input inputId="grn-scan" [beep]="false" [placeholder]="'purchase.grn.scanPlaceholder' | transloco" (scanned)="onScan($event.value)" />
                    <details class="text-sm">
                      <summary class="min-h-11 cursor-pointer py-2">{{ 'purchase.grn.pasteTitle' | transloco }}</summary>
                      <textarea id="grn-paste" rows="4" [(ngModel)]="pasted" [class]="ui.input + ' py-2 font-mono'"
                                [attr.aria-label]="'purchase.grn.pasteTitle' | transloco" [placeholder]="'purchase.grn.pastePlaceholder' | transloco"></textarea>
                      <div class="mt-2 flex flex-wrap items-center gap-2">
                        <button type="button" [class]="ui.btn" [disabled]="!pasted.trim() || busy()" (click)="addPasted()">{{ 'purchase.grn.addSerials' | transloco }}</button>
                        <label [class]="ui.btn + ' cursor-pointer'">
                          {{ 'purchase.grn.importCsv' | transloco }}
                          <input type="file" accept=".csv,.txt,text/csv,text/plain" class="sr-only" (change)="importFile($event)" />
                        </label>
                      </div>
                    </details>
                    <ul class="space-y-1" aria-live="polite">
                      @for (f of feedback(); track f.id) {
                        <li class="rounded-lg px-3 py-2 text-sm" [class]="f.ok ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'">
                          <span class="font-medium">{{ (f.ok ? 'purchase.grn.accepted' : 'purchase.grn.rejected') | transloco }}</span> · <code dir="ltr">{{ f.serial }}</code> · {{ f.text }}
                        </li>
                      }
                    </ul>
                  </div>
                }

                <div [class]="ui.tableWrap">
                  <table class="w-full min-w-[40rem] text-start text-sm">
                    <thead [class]="ui.thead"><tr>
                      <th scope="col" [class]="ui.th">{{ 'purchase.grn.serial' | transloco }}</th>
                      <th scope="col" [class]="ui.th">{{ 'purchase.grn.inspection' | transloco }}</th>
                      <th scope="col" [class]="ui.th">{{ 'purchase.grn.note' | transloco }}</th>
                      @if (!posted()) { <th scope="col" class="w-12"><span class="sr-only">{{ 'common.actions' | transloco }}</span></th> }
                    </tr></thead>
                    <tbody>
                      @for (s of l.serials; track s.serial; let si = $index) {
                        <tr [class]="ui.tr">
                          <td [class]="ui.td"><code dir="ltr">{{ s.serial }}</code></td>
                          <td [class]="ui.td">
                            @if (posted()) {
                              <app-status-badge [label]="'purchase.grn.inspect.' + s.status | transloco" [tone]="inspTone[s.status]" />
                            } @else {
                              <select [ngModel]="s.status" (ngModelChange)="setStatus(si, $event)" [class]="ui.input" [attr.aria-label]="'purchase.grn.inspection' | transloco">
                                @for (st of statuses; track st) { <option [value]="st">{{ 'purchase.grn.inspect.' + st | transloco }}</option> }
                              </select>
                            }
                          </td>
                          <td [class]="ui.td">
                            @if (posted()) { {{ s.note ?? '—' }} } @else {
                              <input [ngModel]="s.note ?? ''" (ngModelChange)="setNote(si, $event)" [class]="ui.input"
                                     [class.border-red-600]="s.status !== 'accepted' && !s.note?.trim()"
                                     [placeholder]="s.status === 'accepted' ? '' : ('purchase.grn.noteRequired' | transloco)"
                                     [attr.aria-label]="'purchase.grn.note' | transloco" />
                            }
                          </td>
                          @if (!posted()) {
                            <td [class]="ui.td">
                              <button type="button" class="min-h-11 min-w-11 rounded-lg text-red-600" (click)="removeSerial(si)" [attr.aria-label]="'common.delete' | transloco">✕</button>
                            </td>
                          }
                        </tr>
                      } @empty {
                        <tr><td colspan="4" class="px-4 py-6 text-center text-slate-500">{{ 'purchase.grn.noSerials' | transloco }}</td></tr>
                      }
                    </tbody>
                  </table>
                </div>
              } @else {
                <div [class]="ui.card">
                  <label for="grn-qty" class="mb-1 block text-sm">{{ 'purchase.grn.qtyReceived' | transloco: { max: left(l) } }}</label>
                  <input placeholder="Enter grn qty..." id="grn-qty" type="number" min="0" [max]="left(l)" [disabled]="posted()" [ngModel]="l.qty" (ngModelChange)="setQty($event)" [class]="ui.input + ' max-w-40'" />
                </div>
              }
            </div>
          }
        </div>
      </section>
    } @else if (error(); as e) {
      <p role="alert" class="text-sm text-red-600">{{ e }}</p>
    }
  `,
})
export class GrnReceivePage implements OnInit {
  private readonly api = inject(PurchaseService);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(ConfirmDialogService);
  private readonly sound = inject(ScanSoundService);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(TranslocoService);
  protected readonly ui = UI;
  protected readonly inspTone = INSPECTION_TONE;
  protected readonly statuses: InspectionStatus[] = ['accepted', 'rejected', 'quarantine'];

  protected readonly grn = signal<Grn | null>(null);
  protected readonly lines = signal<GrnLine[]>([]);
  protected readonly active = signal(0);
  protected readonly feedback = signal<Feedback[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly busy = signal(false);
  protected pasted = '';
  private feedbackId = 0;

  protected readonly line = computed(() => this.lines()[this.active()] ?? null);
  protected readonly posted = computed(() => this.grn()?.status === 'posted');
  protected readonly progress = computed(() => grnProgress(this.lines()));
  protected readonly pct = computed(() => {
    const p = this.progress();
    return p.expected ? Math.min(100, Math.round((p.done / p.expected) * 100)) : 0;
  });
  protected readonly canEdit = computed(() => this.auth.can('purchase.grn.create'));

  async ngOnInit(): Promise<void> {
    try {
      this.load(await firstValueFrom(this.api.grn(Number(this.route.snapshot.paramMap.get('id')))));
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('errors.generic')));
    }
  }

  private load(g: Grn): void {
    // Copy: mock (aur cache) wahi object wapas de sakta hai; naya reference signal ko update karta hai.
    this.grn.set(structuredClone(g));
    this.lines.set(structuredClone(g.lines));
  }

  protected qty(l: GrnLine): number {
    return grnLineQty(l);
  }

  protected left(l: GrnLine): number {
    return Math.max(0, l.orderedQty - l.previouslyReceived);
  }

  private patchLine(fn: (l: GrnLine) => GrnLine): void {
    const i = this.active();
    this.lines.update((ls) => ls.map((l, n) => (n === i ? fn(l) : l)));
  }

  private say(ok: boolean, serial: string, text: string): void {
    this.feedback.update((f) => [{ id: ++this.feedbackId, ok, serial, text }, ...f].slice(0, FEEDBACK_MAX));
    if (ok) this.sound.success();
    else this.sound.error();
  }

  /** Ek serial: format, is GRN mein duplicate, line poori, phir server check (stock duplicate, wrong model). */
  async onScan(raw: string): Promise<void> {
    const l = this.line();
    if (!l?.serialized || this.posted()) return;
    const serial = normalizeSerial(raw);
    if (!isSerialFormatOk(serial)) return this.say(false, serial || raw, this.i18n.translate('purchase.grn.why.invalid_format'));
    if (this.lines().some((x) => x.serials.some((s) => s.serial === serial))) {
      return this.say(false, serial, this.i18n.translate('purchase.grn.why.duplicate_here'));
    }
    if (this.qty(l) >= this.left(l)) return this.say(false, serial, this.i18n.translate('purchase.grn.why.line_full', { n: this.left(l) }));
    try {
      const res = await firstValueFrom(this.api.checkSerial(serial, l.productId));
      if (!res.ok) {
        const key = 'purchase.grn.why.' + res.reason;
        return this.say(false, serial, this.i18n.translate(key, { model: res.actualModel ?? '' }));
      }
      this.patchLine((x) => ({ ...x, serials: [...x.serials, { serial, productId: x.productId, status: 'accepted', note: null }] }));
      this.say(true, serial, l.name);
    } catch {
      this.say(false, serial, this.i18n.translate('errors.generic'));
    }
  }

  protected async addPasted(): Promise<void> {
    const list = parseSerialList(this.pasted);
    this.pasted = '';
    for (const s of list) await this.onScan(s);
  }

  protected async importFile(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 1_000_000) {
      this.error.set(this.i18n.translate('purchase.grn.fileTooBig'));
      return;
    }
    this.pasted = await file.text();
    await this.addPasted();
  }

  protected setStatus(i: number, status: InspectionStatus): void {
    this.patchLine((l) => ({ ...l, serials: l.serials.map((s, n) => (n === i ? { ...s, status } : s)) }));
  }

  protected setNote(i: number, note: string): void {
    this.patchLine((l) => ({ ...l, serials: l.serials.map((s, n) => (n === i ? { ...s, note: note || null } : s)) }));
  }

  protected removeSerial(i: number): void {
    this.patchLine((l) => ({ ...l, serials: l.serials.filter((_, n) => n !== i) }));
  }

  protected setQty(v: number): void {
    this.patchLine((l) => ({ ...l, qty: Math.max(0, Math.min(this.left(l), Math.floor(+v || 0))) }));
  }

  protected async saveDraft(): Promise<void> {
    await this.run(async () => {
      this.load(await firstValueFrom(this.api.saveGrn(this.grn()!.id, this.lines())));
      this.notice.set(this.i18n.translate('purchase.grn.draftSaved'));
    });
  }

  protected async post(): Promise<void> {
    const p = this.progress();
    const yes = await this.dialogs.confirm({
      title: this.i18n.translate('purchase.grn.postTitle', { number: this.grn()?.number }),
      message: this.i18n.translate('purchase.grn.postMessage', { done: p.done, expected: p.expected }),
      confirmLabel: this.i18n.translate('purchase.grn.post'),
      cancelLabel: this.i18n.translate('common.cancel'),
    });
    if (!yes) return;
    await this.run(async () => {
      this.load(await firstValueFrom(this.api.postGrn(this.grn()!.id, this.lines())));
      this.feedback.set([]);
      this.notice.set(this.i18n.translate('purchase.grn.postedNotice'));
    });
  }

  private async run(fn: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    this.notice.set(null);
    try {
      await fn();
    } catch (e) {
      this.error.set(errorMessage(e, this.i18n.translate('errors.generic')));
    } finally {
      this.busy.set(false);
    }
  }

}
