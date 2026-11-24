import { JsonPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, delay, of } from 'rxjs';
import {
  BadgeTone,
  ConfirmDialogService,
  DateInputComponent,
  FormFieldComponent,
  NumberInputComponent,
  ScanEvent,
  ScanInputComponent,
  SearchSelectComponent,
  SelectOption,
  StatusBadgeComponent,
  PrintService,
  escapeHtml,
} from '../../shared/ui';
import { PageHeaderComponent } from '../../shared/ui/page-header.component';
import { ImportWizardComponent } from '../../shared/ui/import-wizard/import-wizard.component';
import { ImportField, ImportValue } from '../../shared/ui/import-wizard/import-utils';
import { ScanCameraComponent } from '../../shared/ui/scan-input/scan-camera.component';
import { ScanSoundService } from '../../shared/ui/scan-input/scan-sound.service';

interface ScanLogEntry {
  value: string;
  ok: boolean;
  source: 'scanner' | 'typed' | 'camera' | 'rejected';
}

const BRANDS: SelectOption[] = [
  { id: 1, label: 'Dell' },
  { id: 2, label: 'HP' },
  { id: 3, label: 'Lenovo' },
  { id: 4, label: 'Apple' },
  { id: 5, label: 'Asus' },
  { id: 6, label: 'Acer' },
  { id: 7, label: 'MSI' },
];

const STOCK_STATUSES: { label: string; tone: BadgeTone }[] = [
  { label: 'In Stock', tone: 'success' },
  { label: 'Reserved', tone: 'info' },
  { label: 'In Transit', tone: 'info' },
  { label: 'Sold', tone: 'neutral' },
  { label: 'Returned', tone: 'warning' },
  { label: 'In Repair', tone: 'warning' },
  { label: 'Damaged', tone: 'danger' },
  { label: 'Quarantine', tone: 'danger' },
];

/** Dev-only page: Step 3 ke saare shared components ek jagah. Route sirf dev mode mein hai. */
@Component({
  selector: 'app-components-showcase',
  imports: [
    JsonPipe,
    ReactiveFormsModule,
    PageHeaderComponent,
    FormFieldComponent,
    NumberInputComponent,
    DateInputComponent,
    SearchSelectComponent,
    ScanInputComponent,
    ScanCameraComponent,
    StatusBadgeComponent,
    ImportWizardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      title="Components showcase"
      subtitle="Step 3 shared components. Dev only. Theme topbar se badlein, width 360px tak chhoti karke bhi dekhein." />

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <!-- SCAN -->
      <section class="rounded-xl border border-border bg-card p-4" aria-labelledby="sc-scan-h">
        <h2 id="sc-scan-h" class="mb-1 text-lg font-semibold">Scan input</h2>
        <p class="mb-3 text-sm text-muted">
          USB scanner ya haath se likh kar Enter dabayein. "BAD" se shuru hone wala code error dikhata hai.
        </p>

        <label for="sc-scan-1" class="mb-1.5 block text-sm font-medium">Scanner ya haath</label>
        <app-scan-input
          #scan1
          inputId="sc-scan-1"
          placeholder="Serial scan karein"
          [showCamera]="true"
          [beep]="false"
          (scanned)="onScanned($event)"
          (rejected)="onRejected($event)"
          (cameraClick)="cameraOpen.set(true)" />

        <label for="sc-scan-2" class="mb-1.5 mt-4 block text-sm font-medium">
          Sirf scanner (haath se type reject)
        </label>
        <app-scan-input
          inputId="sc-scan-2"
          placeholder="Sirf USB scanner"
          [scannerOnly]="true"
          [beep]="false"
          (scanned)="onScanned($event)"
          (rejected)="onRejected($event)" />

        <div class="mt-4" aria-live="polite">
          @if (last(); as l) {
            <div
              class="flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-medium"
              [class]="
                l.ok
                  ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                  : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
              ">
              <i [class]="l.ok ? 'pi pi-check-circle' : 'pi pi-times-circle'" aria-hidden="true"></i>
              <span class="break-all">{{ l.value }}</span>
              <span class="ms-auto text-xs font-normal">{{ l.source }}</span>
            </div>
          } @else {
            <p class="text-sm text-muted">Abhi koi scan nahi hua.</p>
          }
        </div>

        @if (log().length > 1) {
          <ul class="mt-3 divide-y divide-border rounded-lg border border-border text-sm">
            @for (e of log(); track $index) {
              <li class="flex items-center gap-2 px-3 py-2">
                <i
                  [class]="e.ok ? 'pi pi-check text-success' : 'pi pi-times text-danger'"
                  aria-hidden="true"></i>
                <span class="break-all">{{ e.value }}</span>
                <span class="ms-auto text-xs text-muted">{{ e.source }}</span>
              </li>
            }
          </ul>
        }
      </section>

      <!-- INPUTS -->
      <section class="rounded-xl border border-border bg-card p-4" aria-labelledby="sc-form-h">
        <h2 id="sc-form-h" class="mb-3 text-lg font-semibold">Number, date aur search select</h2>
        <form [formGroup]="form" class="flex flex-col gap-4" (ngSubmit)="submit()" novalidate>
          <app-form-field
            #fPrice
            label="Price"
            inputId="sc-price"
            [control]="form.controls.price"
            [required]="true"
            hint="Money input: focus par sada number, blur par format.">
            <app-number-input
              inputId="sc-price"
              formControlName="price"
              prefix="Rs"
              [decimals]="2"
              [min]="0"
              [describedBy]="fPrice.describedBy()" />
          </app-form-field>

          <app-form-field
            #fQty
            label="Quantity"
            inputId="sc-qty"
            [control]="form.controls.qty"
            hint="1 se 100 tak.">
            <app-number-input
              inputId="sc-qty"
              formControlName="qty"
              [min]="1"
              [max]="100"
              [describedBy]="fQty.describedBy()" />
          </app-form-field>

          <app-form-field
            #fDate
            label="Warranty expiry"
            inputId="sc-date"
            [control]="form.controls.expiry"
            [required]="true"
            hint="Aaj ya us ke baad ki date.">
            <app-date-input
              inputId="sc-date"
              formControlName="expiry"
              [min]="today"
              [describedBy]="fDate.describedBy()" />
          </app-form-field>

          <app-form-field
            #fBrand
            label="Brand"
            inputId="sc-brand"
            [control]="form.controls.brand"
            hint="Type karein, arrow keys se chunein. Pehle se Lenovo (id 3) chuna hua hai.">
            <app-search-select
              inputId="sc-brand"
              formControlName="brand"
              placeholder="Brand dhoondein"
              [loader]="searchBrands"
              [resolve]="resolveBrand"
              [describedBy]="fBrand.describedBy()" />
          </app-form-field>

          <div class="flex flex-wrap gap-2">
            <button
              type="submit"
              class="min-h-12 rounded-lg bg-accent px-5 font-medium text-white">
              Validate
            </button>
            <button
              type="button"
              class="min-h-12 rounded-lg border border-input px-5 font-medium"
              (click)="resetForm()">
              Reset
            </button>
          </div>
        </form>
        <pre class="mt-4 overflow-x-auto rounded-lg bg-page p-3 text-xs">{{ form.getRawValue() | json }}</pre>
      </section>

      <!-- IMPORT -->
      <section class="rounded-xl border border-border bg-card p-4 lg:col-span-2" aria-labelledby="sc-imp-h">
        <h2 id="sc-imp-h" class="mb-1 text-lg font-semibold">Import wizard</h2>
        <p class="mb-3 text-sm text-muted">
          CSV ya Excel chunein. Fields: SKU (zaroori, unique), Name (zaroori), Price (zaroori, number), Warranty expiry (date yyyy-mm-dd).
        </p>
        @if (importResult(); as res) {
          <p class="mb-3 rounded-lg bg-green-100 px-3 py-3 text-sm text-green-800 dark:bg-green-900/40 dark:text-green-300" role="status">
            {{ res }}
          </p>
        }
        <app-import-wizard
          [fields]="importFields"
          (imported)="onImported($event)"
          (cancelled)="importResult.set('Cancel hua')" />
      </section>

      <!-- PRINT -->
      <section class="rounded-xl border border-border bg-card p-4" aria-labelledby="sc-print-h">
        <h2 id="sc-print-h" class="mb-1 text-lg font-semibold">Print service</h2>
        <p class="mb-3 text-sm text-muted">Browser ka print dialog khulta hai. "Save as PDF" se bhi dekh sakte hain.</p>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="min-h-12 rounded-lg border border-input px-4 font-medium" (click)="printReceipt()">
            <i class="pi pi-print me-2" aria-hidden="true"></i>Receipt (80mm)
          </button>
          <button type="button" class="min-h-12 rounded-lg border border-input px-4 font-medium" (click)="printInvoice()">
            <i class="pi pi-print me-2" aria-hidden="true"></i>Invoice (A4)
          </button>
        </div>
      </section>

      <!-- DIALOGS -->
      <section class="rounded-xl border border-border bg-card p-4" aria-labelledby="sc-dlg-h">
        <h2 id="sc-dlg-h" class="mb-3 text-lg font-semibold">Dialogs</h2>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="min-h-12 rounded-lg border border-input px-4 font-medium"
            (click)="askConfirm(false)">
            Confirm
          </button>
          <button
            type="button"
            class="min-h-12 rounded-lg border border-input px-4 font-medium"
            (click)="askConfirm(true)">
            Confirm (danger)
          </button>
          <button
            type="button"
            class="min-h-12 rounded-lg border border-input px-4 font-medium"
            (click)="askReason()">
            Reason zaroori
          </button>
          <button
            type="button"
            class="min-h-12 rounded-lg border border-input px-4 font-medium"
            (click)="askApproval()">
            Approval
          </button>
        </div>
        <p class="mt-4 text-sm" aria-live="polite">
          <span class="text-muted">Natija:</span> {{ dialogResult() }}
        </p>
      </section>

      <!-- BADGES -->
      <section class="rounded-xl border border-border bg-card p-4" aria-labelledby="sc-badge-h">
        <h2 id="sc-badge-h" class="mb-3 text-lg font-semibold">Stock status badges</h2>
        <div class="flex flex-wrap gap-2">
          @for (s of statuses; track s.label) {
            <app-status-badge [label]="s.label" [tone]="s.tone" />
          }
        </div>
      </section>
    </div>

    @defer (when cameraOpen()) {
      <app-scan-camera
        [open]="cameraOpen()"
        (detected)="onCamera($event)"
        (closed)="cameraOpen.set(false)" />
    }
  `,
})
export class ComponentsShowcasePage {
  private readonly dialogs = inject(ConfirmDialogService);
  private readonly sound = inject(ScanSoundService);
  private readonly printer = inject(PrintService);

  protected readonly statuses = STOCK_STATUSES;
  protected readonly today = new Date().toISOString().slice(0, 10);
  protected readonly cameraOpen = signal(false);
  protected readonly log = signal<ScanLogEntry[]>([]);
  protected readonly last = signal<ScanLogEntry | null>(null);
  protected readonly dialogResult = signal('-');

  protected readonly form = new FormGroup({
    price: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
    qty: new FormControl<number | null>(1),
    expiry: new FormControl<string | null>(null, [Validators.required]),
    brand: new FormControl<number | string | null>(3),
  });

  protected readonly searchBrands = (q: string): Observable<SelectOption[]> =>
    of(BRANDS.filter((b) => b.label.toLowerCase().includes(q.trim().toLowerCase()))).pipe(
      delay(300),
    );

  protected readonly resolveBrand = (id: number | string): Observable<SelectOption | null> =>
    of(BRANDS.find((b) => b.id === id) ?? null).pipe(delay(150));

  protected onScanned(e: ScanEvent): void {
    const ok = !e.value.toUpperCase().startsWith('BAD');
    if (ok) this.sound.success();
    else this.sound.error();
    this.push({ value: e.value, ok, source: e.scanner ? 'scanner' : 'typed' });
  }

  protected onRejected(value: string): void {
    this.push({ value, ok: false, source: 'rejected' });
  }

  protected onCamera(value: string): void {
    this.push({ value, ok: true, source: 'camera' });
  }

  protected submit(): void {
    this.form.markAllAsTouched();
  }

  protected resetForm(): void {
    this.form.reset({ price: null, qty: 1, expiry: null, brand: 3 });
  }

  protected async askConfirm(danger: boolean): Promise<void> {
    const ok = await this.dialogs.confirm({
      title: danger ? 'Serial delete karein' : 'Save karein',
      message: danger
        ? 'Ye serial hamesha ke liye hat jayega. Wapas nahi aayega.'
        : 'Kya aap changes save karna chahte hain?',
      danger,
    });
    this.dialogResult.set(ok ? 'Confirm hua' : 'Cancel hua');
  }

  protected async askReason(): Promise<void> {
    const reason = await this.dialogs.reason({
      title: 'Label dobara print',
      message: 'Dobara print ki wajah likhna zaroori hai.',
      minLength: 10,
    });
    this.dialogResult.set(reason === null ? 'Cancel hua' : 'Wajah: ' + reason);
  }

  protected async askApproval(): Promise<void> {
    const res = await this.dialogs.approve({
      title: 'Discount approval',
      message: 'Is discount ke liye approval chahiye.',
    });
    this.dialogResult.set(res === null ? 'Cancel hua' : 'Approved. Note: ' + (res.note || '(khali)'));
  }

  protected readonly importResult = signal<string | null>(null);
  protected readonly importFields: ImportField[] = [
    { key: 'sku', label: 'SKU', required: true, unique: true },
    { key: 'name', label: 'Name', required: true },
    { key: 'price', label: 'Price', required: true, type: 'number' },
    { key: 'expiry', label: 'Warranty expiry', type: 'date' },
  ];

  protected onImported(rows: Record<string, ImportValue>[]): void {
    this.importResult.set(rows.length + ' rows import ke liye tayyar. Pehli: ' + JSON.stringify(rows[0]));
  }

  protected printReceipt(): void {
    const lines = [
      { name: 'Dell Latitude 5440', serial: 'SN-DL-100234', amount: 'Rs 185,000.00' },
      { name: 'Laptop Bag', serial: '', amount: 'Rs 3,500.00' },
    ];
    const rows = lines
      .map(
        (l) =>
          '<tr><td>' + escapeHtml(l.name) + (l.serial ? '<div class="serials">' + escapeHtml(l.serial) + '</div>' : '') +
          '</td><td class="r">' + escapeHtml(l.amount) + '</td></tr>',
      )
      .join('');
    const body =
      '<h1 class="c b" style="font-size:14px">Laptop ERP</h1><p class="c muted">Karachi Main</p><hr>' +
      '<p>Receipt: POS-000123</p><p>Date: ' + escapeHtml(new Date().toLocaleString()) + '</p><hr>' +
      '<table>' + rows + '</table><hr>' +
      '<table><tr class="b"><td>Total</td><td class="r">Rs 188,500.00</td></tr></table><hr>' +
      '<p class="c">Shukriya!</p>';
    void this.printer.print({ title: 'Receipt POS-000123', body, paper: 'thermal80' });
  }

  protected printInvoice(): void {
    const rows = [
      { name: 'Dell Latitude 5440', qty: 2, price: 'Rs 185,000.00', serials: ['SN-DL-100234', 'SN-DL-100235'] },
      { name: 'HP ProBook 450', qty: 1, price: 'Rs 160,000.00', serials: ['SN-HP-880001'] },
    ]
      .map(
        (l) =>
          '<tr><td>' + escapeHtml(l.name) + '<div class="serials">' + l.serials.map((s) => escapeHtml(s)).join(', ') +
          '</div></td><td class="r">' + escapeHtml(l.qty) + '</td><td class="r">' + escapeHtml(l.price) + '</td></tr>',
      )
      .join('');
    const body =
      '<h1 class="b" style="font-size:20px">Invoice INV-000045</h1>' +
      '<p class="muted">Laptop ERP, Karachi Main</p><br>' +
      '<p><span class="b">Customer:</span> Ali Traders</p>' +
      '<p><span class="b">Date:</span> ' + escapeHtml(new Date().toLocaleDateString()) + '</p><br>' +
      '<table><thead><tr><th scope="col">Item / Serials</th><th scope="col" class="r">Qty</th><th scope="col" class="r">Price</th></tr></thead><tbody>' + rows + '</tbody></table><br>' +
      '<p class="r b">Total: Rs 530,000.00</p>';
    void this.printer.print({ title: 'Invoice INV-000045', body, paper: 'a4' });
  }

  private push(entry: ScanLogEntry): void {
    this.last.set(entry);
    this.log.update((l) => [entry, ...l].slice(0, 6));
  }
}
