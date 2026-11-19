import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import {
  ImportField,
  ImportValue,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  autoMap,
  parseCsv,
  sampleCsv,
  validateRows,
} from './import-utils';

type Step = 1 | 2 | 3;
const PREVIEW_LIMIT = 50;

/**
 * Import wizard: file chuno -> columns match karo -> preview -> import.
 * Sirf theek rows (imported) mein jati hain. Asli save parent karta hai (API).
 * CSV aur Excel (.xlsx/.xls). Excel library lazy load hoti hai.
 * Text abhi English hai, i18n Step 18 mein.
 */
@Component({
  selector: 'app-import-wizard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4">
      <ol class="flex flex-wrap gap-2 text-sm" aria-label="Import steps">
        @for (s of steps; track s.n) {
          <li
            class="flex items-center gap-2 rounded-full border px-3 py-1"
            [class]="step() === s.n ? 'border-accent text-accent font-medium' : 'border-border text-muted'"
            [attr.aria-current]="step() === s.n ? 'step' : null">
            <span>{{ s.n }}</span>
            <span>{{ s.label }}</span>
          </li>
        }
      </ol>

      @if (error(); as msg) {
        <p role="alert" class="flex items-center gap-2 rounded-lg bg-red-100 px-3 py-3 text-sm text-red-800 dark:bg-red-900/40 dark:text-red-300">
          <i class="pi pi-times-circle" aria-hidden="true"></i>{{ msg }}
        </p>
      }

      @switch (step()) {
        @case (1) {
          <div class="flex flex-col gap-3">
            <label for="import-file" class="text-sm font-medium">CSV ya Excel file</label>
            <input
              id="import-file"
              type="file"
              accept=".csv,.xlsx,.xls"
              class="min-h-11 w-full rounded-lg border border-input p-2 text-sm file:me-3 file:min-h-9 file:rounded-md file:border-0 file:bg-accent file:px-3 file:text-white"
              (change)="onFile($event)" />
            <p class="text-xs text-muted">Pehli line header honi chahiye. Max 5 MB aur 5000 rows.</p>
            @if (loading()) {
              <p role="status" class="text-sm text-muted">File parh rahe hain...</p>
            }
            <div>
              <button type="button" class="min-h-11 rounded-lg border border-input px-4 text-sm" (click)="downloadSample()">
                <i class="pi pi-download me-2" aria-hidden="true"></i>Sample CSV download
              </button>
            </div>
          </div>
        }

        @case (2) {
          <div class="flex flex-col gap-3">
            <p class="text-sm text-muted">
              {{ fileName() }}: {{ data().length }} rows. Har field ka column chunein.
            </p>
            <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
              @for (f of fields(); track f.key; let i = $index) {
                <div class="flex flex-col gap-1.5">
                  <label [attr.for]="'import-map-' + f.key" class="text-sm font-medium">
                    {{ f.label }}
                    @if (f.required) {
                      <span class="ms-1 text-red-600" aria-hidden="true">*</span>
                      <span class="sr-only">(required)</span>
                    }
                  </label>
                  <select
                    [id]="'import-map-' + f.key"
                    class="min-h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm"
                    [value]="mapping()[i]"
                    (change)="setMap(i, $event)">
                    <option value="-1">(skip)</option>
                    @for (h of headers(); track $index) {
                      <option [value]="$index">{{ h }}</option>
                    }
                  </select>
                </div>
              }
            </div>
            @if (missingRequired().length > 0) {
              <p role="alert" class="text-sm text-danger">
                Zaroori columns match karein: {{ missingRequired().join(', ') }}
              </p>
            }
            <div class="flex flex-wrap gap-2">
              <button type="button" class="min-h-12 rounded-lg border border-input px-5 font-medium" (click)="reset()">Wapas</button>
              <button
                type="button"
                class="min-h-12 rounded-lg bg-accent px-5 font-medium text-white disabled:opacity-50"
                [disabled]="missingRequired().length > 0"
                (click)="step.set(3)">
                Preview
              </button>
            </div>
          </div>
        }

        @case (3) {
          <div class="flex flex-col gap-3">
            <p class="flex flex-wrap gap-4 text-sm" aria-live="polite">
              <span class="text-success"><i class="pi pi-check-circle me-1" aria-hidden="true"></i>{{ validCount() }} theek</span>
              <span [class]="invalidCount() > 0 ? 'text-danger' : 'text-muted'">
                <i class="pi pi-times-circle me-1" aria-hidden="true"></i>{{ invalidCount() }} ghalat
              </span>
            </p>
            @if (invalidCount() > 0) {
              <p class="text-xs text-muted">Ghalat rows import nahi hongi. File theek karke dobara upload kar sakte hain.</p>
            }
            <div class="overflow-x-auto rounded-lg border border-border">
              <table class="w-full min-w-max text-sm">
                <thead class="bg-page text-start text-xs text-muted">
                  <tr>
                    <th class="px-3 py-2 text-start">Line</th>
                    @for (f of fields(); track f.key) {
                      <th class="px-3 py-2 text-start">{{ f.label }}</th>
                    }
                    <th class="px-3 py-2 text-start">Status</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-border">
                  @for (r of previewRows(); track r.line) {
                    <tr [class]="r.errors.length ? 'bg-red-50 dark:bg-red-900/20' : ''">
                      <td class="px-3 py-2 tabular-nums">{{ r.line }}</td>
                      @for (f of fields(); track f.key) {
                        <td class="px-3 py-2">{{ r.values[f.key] ?? '' }}</td>
                      }
                      <td class="px-3 py-2">
                        @if (r.errors.length) {
                          <span class="text-danger">{{ r.errors.join('; ') }}</span>
                        } @else {
                          <span class="text-success">OK</span>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            @if (rows().length > previewRows().length) {
              <p class="text-xs text-muted">Pehli {{ previewRows().length }} rows dikh rahi hain.</p>
            }
            <div class="flex flex-wrap gap-2">
              <button type="button" class="min-h-12 rounded-lg border border-input px-5 font-medium" (click)="step.set(2)">Wapas</button>
              <button
                type="button"
                class="min-h-12 rounded-lg bg-accent px-5 font-medium text-white disabled:opacity-50"
                [disabled]="validCount() === 0"
                (click)="confirm()">
                {{ validCount() }} rows import karein
              </button>
              <button type="button" class="min-h-12 rounded-lg border border-input px-5 font-medium" (click)="cancelled.emit()">Cancel</button>
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class ImportWizardComponent {
  readonly fields = input.required<ImportField[]>();
  readonly imported = output<Record<string, ImportValue>[]>();
  readonly cancelled = output<void>();

  protected readonly steps = [
    { n: 1, label: 'File' },
    { n: 2, label: 'Columns' },
    { n: 3, label: 'Preview' },
  ];
  protected readonly step = signal<Step>(1);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly fileName = signal('');
  protected readonly headers = signal<string[]>([]);
  protected readonly data = signal<string[][]>([]);
  protected readonly mapping = signal<number[]>([]);

  protected readonly missingRequired = computed(() =>
    this.fields()
      .filter((f, i) => f.required && this.mapping()[i] < 0)
      .map((f) => f.label),
  );
  protected readonly rows = computed(() =>
    this.step() === 3 ? validateRows(this.data(), this.mapping(), this.fields()) : [],
  );
  protected readonly previewRows = computed(() => this.rows().slice(0, PREVIEW_LIMIT));
  protected readonly validCount = computed(() => this.rows().filter((r) => r.errors.length === 0).length);
  protected readonly invalidCount = computed(() => this.rows().length - this.validCount());

  protected async onFile(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.error.set(null);
    if (file.size > MAX_IMPORT_BYTES) {
      this.error.set('File 5 MB se badi hai.');
      return;
    }
    this.loading.set(true);
    try {
      const table = await this.readTable(file);
      if (table.length < 2) {
        this.error.set('File mein header ke baad koi row nahi.');
        return;
      }
      if (table.length - 1 > MAX_IMPORT_ROWS) {
        this.error.set('Max ' + MAX_IMPORT_ROWS + ' rows ki ijazat hai.');
        return;
      }
      const headers = table[0].map((h) => String(h ?? '').trim());
      this.fileName.set(file.name);
      this.headers.set(headers);
      this.data.set(table.slice(1).map((r) => r.map((c) => String(c ?? ''))));
      this.mapping.set(autoMap(headers, this.fields()));
      this.step.set(2);
    } catch {
      this.error.set('File parhi nahi ja saki. CSV ya Excel file chunein.');
    } finally {
      this.loading.set(false);
      input.value = '';
    }
  }

  protected setMap(i: number, e: Event): void {
    const v = Number((e.target as HTMLSelectElement).value);
    this.mapping.update((m) => m.map((x, idx) => (idx === i ? v : x)));
  }

  protected confirm(): void {
    this.imported.emit(this.rows().filter((r) => r.errors.length === 0).map((r) => r.values));
  }

  protected reset(): void {
    this.step.set(1);
    this.error.set(null);
    this.data.set([]);
    this.headers.set([]);
  }

  protected downloadSample(): void {
    const blob = new Blob([sampleCsv(this.fields())], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'import-sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  private async readTable(file: File): Promise<string[][]> {
    if (/\.xlsx?$/i.test(file.name)) {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' });
      return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
    }
    return parseCsv(new TextDecoder('utf-8').decode(await file.arrayBuffer()));
  }
}
