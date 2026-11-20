import { ChangeDetectionStrategy, Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { HasPermissionDirective } from '../../../core/auth/has-permission.directive';
import { ConfirmDialogService } from '../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { PrintService } from '../../../shared/ui/print/print.service';
import { ScanInputComponent } from '../../../shared/ui/scan-input/scan-input.component';
import { SettingsStore } from '../../settings/stores/settings.store';
import { LabelItem, LabelKind, LabelTemplate, PrintLogEntry } from '../models/label.models';
import { LabelsService } from '../services/labels.service';
import { moneyPkr, renderLabelSheet } from '../utils/label-render';
import { needsReprintReason } from '../utils/label-utils';

const KINDS: LabelKind[] = ['serial', 'sku', 'bin'];
const PREVIEW_MAX = 6;

@Component({
  selector: 'app-labels-page',
  imports: [FormsModule, RouterLink, TranslocoPipe, HasPermissionDirective, ScanInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">{{ 'labels.title' | transloco }}</h1>
        <a *hasPermission="'barcode.label.create'" routerLink="templates"
           class="inline-flex min-h-11 items-center rounded-lg border border-slate-400 px-4 text-sm">
          {{ 'labels.templates' | transloco }}
        </a>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
        <label for="label-scan" class="mb-2 block text-sm font-medium">{{ 'labels.scanToReprint' | transloco }}</label>
        <app-scan-input inputId="label-scan" [placeholder]="'labels.scanPlaceholder' | transloco" (scanned)="onScan($event.value)"></app-scan-input>
        @if (scanError(); as e) {
          <p role="alert" class="mt-2 text-sm text-red-600">{{ e }}</p>
        }
      </div>

      <div role="tablist" class="flex gap-2">
        @for (k of kinds; track k) {
          <button type="button" role="tab" [attr.aria-selected]="kind() === k"
                  class="min-h-11 rounded-lg border px-4 text-sm"
                  [class]="kind() === k ? 'border-[#1E3A8A] bg-[#1E3A8A] text-white' : 'border-slate-400'"
                  (click)="setKind(k)">
            {{ 'labels.kinds.' + k | transloco }}
          </button>
        }
      </div>

      <div class="flex flex-wrap items-end gap-3">
        <div>
          <label for="label-q" class="mb-1 block text-sm">{{ 'common.search' | transloco }}</label>
          <input id="label-q" [ngModel]="q()" (ngModelChange)="q.set($event); reload()"
                 class="min-h-11 w-64 rounded-lg border border-slate-400 bg-transparent px-3 text-sm" />
        </div>
        @if (kind() === 'serial') {
          <div>
            <label for="label-grn" class="mb-1 block text-sm">{{ 'labels.fromGrn' | transloco }}</label>
            <select id="label-grn" [ngModel]="grn()" (ngModelChange)="grn.set($event); reload()"
                    class="min-h-11 rounded-lg border border-slate-400 bg-transparent px-3 text-sm">
              <option value="">{{ 'labels.allGrns' | transloco }}</option>
              @for (g of grns; track g) { <option [value]="g">{{ g }}</option> }
            </select>
          </div>
        }
        <div>
          <label for="label-tpl" class="mb-1 block text-sm">{{ 'labels.template' | transloco }}</label>
          <select id="label-tpl" [ngModel]="templateId()" (ngModelChange)="templateId.set(+$event)"
                  class="min-h-11 rounded-lg border border-slate-400 bg-transparent px-3 text-sm">
            @for (t of kindTemplates(); track t.id) { <option [value]="t.id">{{ t.name }}</option> }
          </select>
        </div>
        <button *hasPermission="'barcode.label.print'" type="button"
                class="min-h-11 rounded-lg bg-[#1E3A8A] px-5 text-sm text-white disabled:opacity-50"
                [disabled]="selectedItems().length === 0 || printing()" (click)="print()">
          {{ 'labels.print' | transloco: { count: selectedItems().length } }}
        </button>
      </div>
      <p class="text-xs text-slate-600 dark:text-slate-400">{{ 'labels.pdfHint' | transloco }}</p>
      @if (actionError(); as e) {
        <p role="alert" class="text-sm text-red-600">{{ e }}</p>
      }

      <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
        <table class="w-full min-w-[40rem] text-start text-sm">
          <thead class="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400">
            <tr>
              <th scope="col" class="w-12 px-4 py-3">
                <input type="checkbox" class="size-5" [checked]="allSelected()" (change)="toggleAll()"
                       [attr.aria-label]="'labels.selectAll' | transloco" />
              </th>
              <th scope="col" class="px-4 py-3 text-start font-medium">{{ 'labels.code' | transloco }}</th>
              <th scope="col" class="px-4 py-3 text-start font-medium">{{ 'common.name' | transloco }}</th>
              <th scope="col" class="px-4 py-3 text-start font-medium">{{ 'labels.bin' | transloco }}</th>
              <th scope="col" class="px-4 py-3 text-start font-medium">{{ 'labels.printed' | transloco }}</th>
            </tr>
          </thead>
          <tbody>
            @for (i of items(); track i.code) {
              <tr class="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td class="px-4 py-2">
                  <input type="checkbox" class="size-5" [checked]="selected().has(i.code)" (change)="toggle(i.code)"
                         [attr.aria-label]="i.code" />
                </td>
                <td class="px-4 py-2"><code dir="ltr">{{ i.code }}</code></td>
                <td class="px-4 py-2">{{ i.name }}</td>
                <td class="px-4 py-2">{{ i.bin ?? '—' }}</td>
                <td class="px-4 py-2">
                  @if (i.printCount > 0) {
                    <span class="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">{{ 'labels.printedTimes' | transloco: { count: i.printCount } }}</span>
                  } @else { <span class="text-xs text-slate-500">{{ 'labels.notPrinted' | transloco }}</span> }
                </td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="px-4 py-6 text-center text-slate-500">{{ 'common.empty' | transloco }}</td></tr>
            }
          </tbody>
        </table>
      </div>

      @if (preview(); as html) {
        <div>
          <h2 class="mb-2 text-base font-semibold">{{ 'labels.preview' | transloco }}</h2>
          <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white p-4 text-black" [innerHTML]="html"></div>
        </div>
      }

      <div>
        <h2 class="mb-2 text-base font-semibold">{{ 'labels.history' | transloco }}</h2>
        <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <table class="w-full min-w-[40rem] text-start text-sm">
            <thead class="border-b border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-400">
              <tr>
                <th scope="col" class="px-4 py-3 text-start font-medium">{{ 'labels.when' | transloco }}</th>
                <th scope="col" class="px-4 py-3 text-start font-medium">{{ 'labels.template' | transloco }}</th>
                <th scope="col" class="px-4 py-3 text-start font-medium">{{ 'labels.count' | transloco }}</th>
                <th scope="col" class="px-4 py-3 text-start font-medium">{{ 'labels.by' | transloco }}</th>
                <th scope="col" class="px-4 py-3 text-start font-medium">{{ 'common.reason.label' | transloco }}</th>
              </tr>
            </thead>
            <tbody>
              @for (h of history(); track h.id) {
                <tr class="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td class="px-4 py-2">{{ h.printedAt.slice(0, 16).replace('T', ' ') }}</td>
                  <td class="px-4 py-2">{{ h.templateName }}</td>
                  <td class="px-4 py-2" [title]="h.codes.join(', ')">{{ h.codes.length }}</td>
                  <td class="px-4 py-2">{{ h.printedBy }}</td>
                  <td class="px-4 py-2">
                    @if (h.isReprint) {
                      <span class="me-1 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-900">{{ 'labels.reprint' | transloco }}</span>{{ h.reason }}
                    } @else { — }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="px-4 py-6 text-center text-slate-500">{{ 'common.empty' | transloco }}</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `,
})
export class LabelsPage implements OnInit {
  private readonly api = inject(LabelsService);
  private readonly auth = inject(AuthStore);
  private readonly dialogs = inject(ConfirmDialogService);
  private readonly printer = inject(PrintService);
  private readonly settings = inject(SettingsStore);
  private readonly i18n = inject(TranslocoService);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly kinds = KINDS;
  protected readonly grns = ['GRN-0041', 'GRN-0042'];
  protected readonly kind = signal<LabelKind>('serial');
  protected readonly q = signal('');
  protected readonly grn = signal('');
  protected readonly items = signal<LabelItem[]>([]);
  protected readonly templates = signal<LabelTemplate[]>([]);
  protected readonly templateId = signal<number | null>(null);
  protected readonly selected = signal<ReadonlySet<string>>(new Set());
  /** Scan se aaye items jo current list mein na hon. */
  private readonly extra = signal<LabelItem[]>([]);
  protected readonly history = signal<PrintLogEntry[]>([]);
  protected readonly preview = signal<SafeHtml | null>(null);
  protected readonly printing = signal(false);
  protected readonly actionError = signal<string | null>(null);
  protected readonly scanError = signal<string | null>(null);

  protected readonly kindTemplates = computed(() => this.templates().filter((t) => t.kind === this.kind()));
  protected readonly template = computed(() => this.templates().find((t) => t.id === this.templateId()) ?? null);
  protected readonly selectedItems = computed(() => {
    const pool = new Map([...this.extra(), ...this.items()].map((i) => [i.code, i]));
    return [...this.selected()].map((c) => pool.get(c)).filter((i): i is LabelItem => !!i);
  });
  protected readonly allSelected = computed(() => this.items().length > 0 && this.items().every((i) => this.selected().has(i.code)));

  constructor() {
    effect(() => {
      const t = this.template();
      const items = this.selectedItems().slice(0, PREVIEW_MAX);
      void this.renderPreview(t, items);
    });
  }

  ngOnInit(): void {
    void this.init();
  }

  private async init(): Promise<void> {
    try {
      this.templates.set(await firstValueFrom(this.api.templates()));
      this.pickDefaultTemplate();
      await Promise.all([this.reload(), this.loadHistory(), this.settings.loadCompany().catch(() => undefined)]);
    } catch {
      this.actionError.set(this.i18n.translate('errors.generic'));
    }
  }

  private pickDefaultTemplate(): void {
    const list = this.kindTemplates();
    this.templateId.set((list.find((t) => t.isDefault) ?? list[0])?.id ?? null);
  }

  protected setKind(k: LabelKind): void {
    if (this.kind() === k) return;
    this.kind.set(k);
    this.selected.set(new Set());
    this.extra.set([]);
    this.grn.set('');
    this.pickDefaultTemplate();
    void this.reload();
  }

  async reload(): Promise<void> {
    try {
      this.items.set(await firstValueFrom(this.api.items(this.kind(), this.q(), this.grn())));
    } catch {
      this.actionError.set(this.i18n.translate('errors.generic'));
    }
  }

  private async loadHistory(): Promise<void> {
    this.history.set(await firstValueFrom(this.api.log()));
  }

  protected toggle(code: string): void {
    const next = new Set(this.selected());
    if (next.has(code)) next.delete(code);
    else next.add(code);
    this.selected.set(next);
  }

  protected toggleAll(): void {
    const all = this.allSelected();
    const next = new Set(this.selected());
    this.items().forEach((i) => (all ? next.delete(i.code) : next.add(i.code)));
    this.selected.set(next);
  }

  /** Scan: item dhoond kar us ki tab par le jao aur select kar do. */
  async onScan(code: string): Promise<void> {
    this.scanError.set(null);
    try {
      const found = await firstValueFrom(this.api.lookup(code));
      this.setKind(found.kind);
      if (!this.items().some((i) => i.code === found.code)) this.extra.update((x) => [...x, found]);
      this.selected.update((s) => new Set([...s, found.code]));
    } catch {
      this.scanError.set(this.i18n.translate('labels.notFound', { code }));
    }
  }

  async print(): Promise<void> {
    const template = this.template();
    const items = this.selectedItems();
    if (!template || items.length === 0) return;
    this.actionError.set(null);

    let reason: string | null = null;
    if (needsReprintReason(items)) {
      if (!this.auth.can('barcode.label.reprint')) {
        this.actionError.set(this.i18n.translate('labels.noReprintPermission'));
        return;
      }
      reason = await this.dialogs.reason({
        title: this.i18n.translate('labels.reprintTitle'),
        message: this.i18n.translate('labels.reprintMessage'),
        confirmLabel: this.i18n.translate('labels.reprint'),
        cancelLabel: this.i18n.translate('common.cancel'),
      });
      if (reason === null) return;
    }

    this.printing.set(true);
    try {
      await firstValueFrom(this.api.record({ templateId: template.id, codes: items.map((i) => i.code), reason }));
      const body = await renderLabelSheet(template, items, this.sheetOptions());
      await this.printer.print({ title: this.i18n.translate('labels.title'), body, paper: 'a4', dir: 'ltr' });
      this.selected.set(new Set());
      this.extra.set([]);
      await Promise.all([this.reload(), this.loadHistory()]);
    } catch {
      this.actionError.set(this.i18n.translate('labels.printFailed'));
    } finally {
      this.printing.set(false);
    }
  }

  private sheetOptions() {
    const c = this.settings.company();
    return { company: c?.name ?? '', logoUrl: c?.logo ?? null, money: moneyPkr };
  }

  private async renderPreview(t: LabelTemplate | null, items: LabelItem[]): Promise<void> {
    if (!t || items.length === 0) {
      this.preview.set(null);
      return;
    }
    try {
      const html = await renderLabelSheet(t, items, this.sheetOptions());
      this.preview.set(this.sanitizer.bypassSecurityTrustHtml(html));
    } catch {
      this.preview.set(null);
    }
  }
}
