import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from '../../../core/auth/auth.store';
import { ConfirmDialogService } from '../../../shared/ui/confirm-dialog/confirm-dialog.service';
import { DataTableComponent } from '../../../shared/ui/data-table/data-table.component';
import {
  DEFAULT_TABLE_QUERY,
  RowAction,
  RowActionEvent,
  TableColumn,
  TableQuery,
} from '../../../shared/ui/data-table/data-table.models';
import { PrintService } from '../../../shared/ui/print/print.service';
import { ScanEvent, ScanInputComponent } from '../../../shared/ui/scan-input/scan-input.component';
import { SettingsService } from '../../settings/services/settings.service';
import {
  BARCODE_KINDS,
  BarcodeKind,
  LabelItem,
  LabelTemplate,
  PrintKind,
  PrintLogEntry,
  QueueLine,
} from '../models/barcode.models';
import { LabelsService } from '../services/labels.service';
import { barcodeSvg, validateValue } from '../utils/barcode-render';
import { LabelContext, RenderedLabel, labelCss, labelsBody, totalLabels } from '../utils/label-html';
import { LabelDesignerComponent } from './label-designer.component';

type Tab = 'labels' | 'templates' | 'history';

const MAX_COPIES = 100;

function messageOf(e: unknown, fallback: string): string {
  const err = e as { error?: { message?: string } };
  return err.error?.message ?? fallback;
}

@Component({
  selector: 'app-barcodes-page',
  imports: [FormsModule, TranslocoPipe, DataTableComponent, ScanInputComponent, LabelDesignerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl space-y-4">
      <h1 class="text-xl font-semibold">{{ 'barcodes.title' | transloco }}</h1>

      <div role="tablist" class="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-700">
        @for (t of tabs(); track t) {
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="tab() === t"
            class="min-h-11 border-b-2 px-4 text-sm font-medium"
            [class.border-[#2563EB]]="tab() === t"
            [class.text-[#2563EB]]="tab() === t"
            [class.border-transparent]="tab() !== t"
            (click)="tab.set(t)"
          >
            {{ 'barcodes.tabs.' + t | transloco }}
          </button>
        }
      </div>

      @if (notice(); as n) {
        <p role="status" class="rounded-lg border border-green-600 p-3 text-sm text-green-700 dark:text-green-400">{{ n }}</p>
      }
      @if (actionError(); as msg) {
        <p role="alert" class="rounded-lg border border-red-600 p-3 text-sm text-red-600">{{ msg }}</p>
      }

      @switch (tab()) {
        @case ('labels') {
          <div class="grid gap-4 lg:grid-cols-[1fr_22rem]">
            <div class="space-y-3">
              <div class="flex flex-wrap items-end gap-3">
                <label class="text-sm">
                  <span class="mb-1 block font-medium">{{ 'barcodes.kind' | transloco }}</span>
                  <select
                    class="min-h-11 rounded-lg border border-slate-400 bg-transparent px-3 text-sm"
                    [ngModel]="kind()"
                    (ngModelChange)="setKind($event)"
                  >
                    <option value="">{{ 'barcodes.allKinds' | transloco }}</option>
                    @for (k of kinds; track k) {
                      <option [value]="k">{{ 'barcodes.kinds.' + k | transloco }}</option>
                    }
                  </select>
                </label>
              </div>
              <app-data-table
                [rows]="items()"
                [columns]="itemColumns"
                [total]="itemsTotal()"
                [query]="itemQuery()"
                [loading]="itemsLoading()"
                [error]="itemsError()"
                [actions]="itemActions"
                [emptyMessage]="'barcodes.noItems' | transloco"
                (queryChange)="loadItems($event)"
                (action)="onItemAction($event)"
                (retry)="loadItems(itemQuery())"
              />
            </div>

            <aside class="space-y-4">
              <div class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                <h2 class="mb-3 font-semibold">{{ 'barcodes.queue' | transloco }}</h2>

                <label class="mb-3 block text-sm">
                  <span class="mb-1 block font-medium">{{ 'barcodes.template' | transloco }}</span>
                  <select
                    class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm"
                    [ngModel]="templateId()"
                    (ngModelChange)="selectTemplate(+$event)"
                  >
                    @for (t of templates(); track t.id) {
                      <option [value]="t.id">{{ t.name }} ({{ t.widthMm }}×{{ t.heightMm }} mm)</option>
                    }
                  </select>
                </label>

                @if (queue().length === 0) {
                  <p class="text-sm text-slate-600 dark:text-slate-400">{{ 'barcodes.queueEmpty' | transloco }}</p>
                } @else {
                  <ul class="space-y-2">
                    @for (line of queue(); track line.item.id) {
                      <li class="flex items-center gap-2 text-sm">
                        <span class="min-w-0 flex-1">
                          <span class="block truncate font-medium">{{ line.item.value }}</span>
                          <span class="block truncate text-xs text-slate-600 dark:text-slate-400">{{ line.item.title }}</span>
                        </span>
                        <input
                          type="number"
                          min="1"
                          [max]="maxCopies"
                          class="min-h-11 w-16 rounded-lg border border-slate-400 bg-transparent px-2 text-sm"
                          [attr.aria-label]="'barcodes.copies' | transloco"
                          [ngModel]="line.copies"
                          (ngModelChange)="setCopies(line.item.id, $event)"
                        />
                        <button
                          type="button"
                          class="min-h-11 rounded-lg border border-slate-400 px-3"
                          [attr.aria-label]="('common.delete' | transloco) + ' ' + line.item.value"
                          (click)="removeLine(line.item.id)"
                        >
                          <i class="pi pi-times" aria-hidden="true"></i>
                        </button>
                      </li>
                    }
                  </ul>
                  <p class="mt-3 text-sm">{{ 'barcodes.labelCount' | transloco: { n: labelCount() } }}</p>
                }

                @if (preview(); as p) {
                  <div class="mt-3">
                    <p class="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">{{ 'barcodes.preview' | transloco }}</p>
                    <div class="overflow-hidden rounded border border-dashed border-slate-400 bg-white text-black" [style.width.mm]="p.w" [style.height.mm]="p.h">
                      <div class="lbl-preview" [innerHTML]="p.html"></div>
                    </div>
                  </div>
                }

                @if (can('barcode.label.print')) {
                  <button
                    type="button"
                    class="mt-4 min-h-12 w-full rounded-lg bg-[#2563EB] px-5 font-medium text-white disabled:opacity-50"
                    [disabled]="busy() || queue().length === 0 || !selectedTemplate()"
                    (click)="printQueue()"
                  >
                    {{ 'barcodes.print' | transloco }}
                  </button>
                }
              </div>

              @if (can('barcode.label.reprint')) {
                <div class="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
                  <h2 class="mb-1 font-semibold">{{ 'barcodes.reprintTitle' | transloco }}</h2>
                  <p class="mb-3 text-xs text-slate-600 dark:text-slate-400">{{ 'barcodes.reprintHint' | transloco }}</p>
                  <app-scan-input
                    inputId="reprint-scan"
                    [placeholder]="'barcodes.scanPlaceholder' | transloco"
                    [disabled]="busy()"
                    (scanned)="onReprintScan($event)"
                  />
                </div>
              }
            </aside>
          </div>
        }
        @case ('templates') {
          <app-label-designer
            [templates]="templates()"
            [sample]="sampleItem()"
            [context]="context()"
            (changed)="loadTemplates()"
          />
        }
        @case ('history') {
          <app-data-table
            [rows]="history()"
            [columns]="historyColumns"
            [total]="historyTotal()"
            [query]="historyQuery()"
            [loading]="historyLoading()"
            [error]="historyError()"
            [emptyMessage]="'barcodes.noHistory' | transloco"
            (queryChange)="loadHistory($event)"
            (retry)="loadHistory(historyQuery())"
          />
        }
      }
    </section>
  `,
  styles: [':host ::ng-deep .lbl-preview .lbl { page-break-after: auto; }'],
})
export class BarcodesPage implements OnInit {
  private readonly api = inject(LabelsService);
  private readonly settings = inject(SettingsService);
  private readonly auth = inject(AuthStore);
  private readonly i18n = inject(TranslocoService);
  private readonly dialogs = inject(ConfirmDialogService);
  private readonly printer = inject(PrintService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly date = new DatePipe('en-US');

  protected readonly kinds = BARCODE_KINDS;
  protected readonly maxCopies = MAX_COPIES;

  protected readonly tab = signal<Tab>('labels');
  protected readonly tabs = computed<Tab[]>(() => {
    const out: Tab[] = ['labels'];
    if (this.can('barcode.label.create')) out.push('templates');
    out.push('history');
    return out;
  });

  protected readonly busy = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly actionError = signal<string | null>(null);

  // Items
  protected readonly kind = signal<BarcodeKind | ''>('');
  protected readonly items = signal<LabelItem[]>([]);
  protected readonly itemsTotal = signal(0);
  protected readonly itemsLoading = signal(false);
  protected readonly itemsError = signal<string | null>(null);
  protected readonly itemQuery = signal<TableQuery>({ ...DEFAULT_TABLE_QUERY });

  // Templates + queue
  protected readonly templates = signal<LabelTemplate[]>([]);
  protected readonly templateId = signal(0);
  protected readonly selectedTemplate = computed(() => this.templates().find((t) => t.id === this.templateId()) ?? null);
  protected readonly queue = signal<QueueLine[]>([]);
  protected readonly labelCount = computed(() => totalLabels(this.queue()));
  protected readonly preview = signal<{ html: SafeHtml; w: number; h: number } | null>(null);
  protected readonly context = signal<LabelContext>({ companyName: '', logoUrl: null, formatPrice: (n) => String(n) });
  protected readonly sampleItem = computed<LabelItem>(
    () =>
      this.queue()[0]?.item ??
      this.items()[0] ?? { id: 'sample', kind: 'sku', value: 'SKU-12345', title: 'Sample laptop', subtitle: 'i5 / 16GB / 512GB', price: 199000 },
  );

  // History
  protected readonly history = signal<PrintLogEntry[]>([]);
  protected readonly historyTotal = signal(0);
  protected readonly historyLoading = signal(false);
  protected readonly historyError = signal<string | null>(null);
  protected readonly historyQuery = signal<TableQuery>({ ...DEFAULT_TABLE_QUERY });

  protected readonly itemColumns: TableColumn<LabelItem>[] = [
    { key: 'kind', header: this.i18n.translate('barcodes.kind'), cell: (r) => this.i18n.translate('barcodes.kinds.' + r.kind) },
    { key: 'value', header: this.i18n.translate('barcodes.value'), sortable: true },
    { key: 'title', header: this.i18n.translate('barcodes.name'), sortable: true },
    { key: 'subtitle', header: this.i18n.translate('barcodes.details'), cell: (r) => r.subtitle ?? '' },
  ];
  protected readonly itemActions: RowAction<LabelItem>[] = [
    { id: 'add', label: this.i18n.translate('barcodes.addToQueue'), icon: 'pi pi-plus', visible: () => this.can('barcode.label.print') },
  ];
  protected readonly historyColumns: TableColumn<PrintLogEntry>[] = [
    { key: 'at', header: this.i18n.translate('barcodes.when'), cell: (r) => this.date.transform(r.at, 'dd MMM yyyy, HH:mm') ?? '' },
    { key: 'userName', header: this.i18n.translate('barcodes.user') },
    { key: 'kind', header: this.i18n.translate('barcodes.printKind'), cell: (r) => this.i18n.translate('barcodes.printKinds.' + r.kind) },
    { key: 'templateName', header: this.i18n.translate('barcodes.template') },
    { key: 'labelCount', header: this.i18n.translate('barcodes.labels'), cell: (r) => String(r.labelCount) },
    { key: 'values', header: this.i18n.translate('barcodes.values'), cell: (r) => r.values.join(', ') },
    { key: 'reason', header: this.i18n.translate('barcodes.reason'), cell: (r) => r.reason ?? '' },
  ];

  ngOnInit(): void {
    void this.loadTemplates();
    void this.loadItems(this.itemQuery());
    void this.loadHistory(this.historyQuery());
    void this.loadCompany();
  }

  protected can(key: string): boolean {
    return this.auth.can(key);
  }

  private async loadCompany(): Promise<void> {
    try {
      const c = await firstValueFrom(this.settings.getCompany());
      const fmt = new Intl.NumberFormat('en-PK', { style: 'currency', currency: c.currency || 'PKR', maximumFractionDigits: 0 });
      this.context.set({ companyName: c.name, logoUrl: c.logo, formatPrice: (n) => fmt.format(n) });
    } catch {
      // Company na mile to bhi labels chhap sakte hain (naam ke baghair)
    }
    void this.refreshPreview();
  }

  async loadTemplates(): Promise<void> {
    try {
      const list = await firstValueFrom(this.api.templates());
      this.templates.set(list);
      if (!list.some((t) => t.id === this.templateId())) {
        this.templateId.set((list.find((t) => t.isDefault) ?? list[0])?.id ?? 0);
      }
      void this.refreshPreview();
    } catch (e) {
      this.actionError.set(messageOf(e, this.i18n.translate('errors.generic')));
    }
  }

  protected selectTemplate(id: number): void {
    this.templateId.set(id);
    void this.refreshPreview();
  }

  protected setKind(k: BarcodeKind | ''): void {
    this.kind.set(k);
    void this.loadItems({ ...this.itemQuery(), page: 1, filters: { ...this.itemQuery().filters, kind: k } });
  }

  protected async loadItems(q: TableQuery): Promise<void> {
    this.itemQuery.set(q);
    this.itemsLoading.set(true);
    this.itemsError.set(null);
    try {
      const res = await firstValueFrom(this.api.items(q));
      this.items.set(res.data);
      this.itemsTotal.set(res.total);
    } catch {
      this.itemsError.set(this.i18n.translate('errors.generic'));
    } finally {
      this.itemsLoading.set(false);
    }
  }

  protected async loadHistory(q: TableQuery): Promise<void> {
    this.historyQuery.set(q);
    this.historyLoading.set(true);
    this.historyError.set(null);
    try {
      const res = await firstValueFrom(this.api.printLog(q));
      this.history.set(res.data);
      this.historyTotal.set(res.total);
    } catch {
      this.historyError.set(this.i18n.translate('errors.generic'));
    } finally {
      this.historyLoading.set(false);
    }
  }

  protected onItemAction(e: RowActionEvent<LabelItem>): void {
    if (e.actionId === 'add') this.addToQueue(e.row);
  }

  addToQueue(item: LabelItem): void {
    this.notice.set(null);
    const existing = this.queue().find((l) => l.item.id === item.id);
    if (existing) {
      this.setCopies(item.id, existing.copies + 1);
      return;
    }
    this.queue.update((q) => [...q, { item, copies: 1 }]);
    void this.refreshPreview();
  }

  protected setCopies(id: string, value: number | string): void {
    const n = Math.min(MAX_COPIES, Math.max(1, Math.floor(Number(value) || 1)));
    this.queue.update((q) => q.map((l) => (l.item.id === id ? { ...l, copies: n } : l)));
  }

  protected removeLine(id: string): void {
    this.queue.update((q) => q.filter((l) => l.item.id !== id));
    void this.refreshPreview();
  }

  private async refreshPreview(): Promise<void> {
    const t = this.selectedTemplate();
    const item = this.queue()[0]?.item;
    if (!t || !item) {
      this.preview.set(null);
      return;
    }
    try {
      const svg = await barcodeSvg(item.value, t.symbology);
      const html = `<style>${labelCss(t)}</style>` + labelsBody(t, [{ item, svg, copies: 1 }], this.context());
      // Hamara apna HTML: user ka har text escapeHtml se guzra hai
      this.preview.set({ html: this.sanitizer.bypassSecurityTrustHtml(html), w: t.widthMm, h: t.heightMm });
    } catch {
      this.preview.set(null);
    }
  }

  /** Labels bana kar log karta hai, phir print dialog kholta hai. */
  private async print(lines: QueueLine[], kind: PrintKind, reason: string | null): Promise<boolean> {
    const t = this.selectedTemplate();
    if (!t) return false;
    this.actionError.set(null);
    this.notice.set(null);

    const bad = lines.filter((l) => validateValue(l.item.value, t.symbology) !== null);
    if (bad.length) {
      this.actionError.set(
        this.i18n.translate('barcodes.errors.invalidFor', { values: bad.map((l) => l.item.value).join(', ') }),
      );
      return false;
    }

    this.busy.set(true);
    try {
      const rendered: RenderedLabel[] = await Promise.all(
        lines.map(async (l) => ({ item: l.item, copies: l.copies, svg: await barcodeSvg(l.item.value, t.symbology) })),
      );
      const count = totalLabels(rendered);
      await firstValueFrom(
        this.api.logPrint({ templateId: t.id, kind, reason, values: lines.map((l) => l.item.value), labelCount: count }),
      );
      void this.printer.print({
        title: this.i18n.translate('barcodes.title'),
        body: labelsBody(t, rendered, this.context()),
        paper: 'label',
        extraCss: labelCss(t),
      });
      this.notice.set(this.i18n.translate('barcodes.printed', { n: count }));
      void this.loadHistory(this.historyQuery());
      return true;
    } catch (e) {
      this.actionError.set(messageOf(e, this.i18n.translate('errors.generic')));
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  protected async printQueue(): Promise<void> {
    if (await this.print(this.queue(), 'print', null)) this.queue.set([]);
    void this.refreshPreview();
  }

  protected async onReprintScan(e: ScanEvent): Promise<void> {
    this.actionError.set(null);
    let item: LabelItem;
    try {
      item = await firstValueFrom(this.api.lookup(e.value));
    } catch (err) {
      this.actionError.set(messageOf(err, this.i18n.translate('barcodes.errors.notFound')));
      return;
    }
    const reason = await this.dialogs.reason({
      title: this.i18n.translate('barcodes.reprintTitle'),
      message: this.i18n.translate('barcodes.reprintMessage', { value: item.value }),
      confirmLabel: this.i18n.translate('barcodes.reprint'),
      cancelLabel: this.i18n.translate('common.cancel'),
      minLength: 10,
    });
    if (reason === null) return;
    await this.print([{ item, copies: 1 }], 'reprint', reason);
  }
}
