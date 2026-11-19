import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialogService } from '../../../shared/ui/confirm-dialog/confirm-dialog.service';
import {
  LABEL_FIELDS,
  LabelField,
  LabelItem,
  LabelTemplate,
  LabelTemplateInput,
  SIZE_PRESETS,
  SYMBOLOGIES,
} from '../models/barcode.models';
import { LabelsService } from '../services/labels.service';
import { barcodeSvg } from '../utils/barcode-render';
import { LabelContext, labelCss, labelsBody } from '../utils/label-html';

const EMPTY: LabelTemplateInput = {
  name: '',
  widthMm: 50,
  heightMm: 25,
  symbology: 'code128',
  fields: ['title', 'value', 'price'],
  showLogo: false,
  isDefault: false,
};

/** Client-side jaanch (backend dobara karta hai). Ghalti ki translation key ya null. */
export function draftError(d: LabelTemplateInput): string | null {
  if (!d.name.trim()) return 'barcodes.errors.nameRequired';
  if (d.name.trim().length > 60) return 'barcodes.errors.nameLong';
  if (!(d.widthMm >= 20 && d.widthMm <= 150) || !(d.heightMm >= 10 && d.heightMm <= 150)) return 'barcodes.errors.size';
  return null;
}

@Component({
  selector: 'app-label-designer',
  imports: [FormsModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <div class="space-y-2">
        <button
          type="button"
          class="min-h-12 w-full rounded-lg bg-[#2563EB] px-5 font-medium text-white"
          (click)="edit(null)"
        >
          {{ 'barcodes.newTemplate' | transloco }}
        </button>
        <ul class="space-y-1">
          @for (t of templates(); track t.id) {
            <li>
              <button
                type="button"
                class="min-h-11 w-full rounded-lg border px-3 text-start text-sm"
                [class.border-[#2563EB]]="editingId() === t.id"
                [class.border-slate-300]="editingId() !== t.id"
                (click)="edit(t)"
              >
                <span class="block font-medium">{{ t.name }}</span>
                <span class="block text-xs text-slate-600 dark:text-slate-400">
                  {{ t.widthMm }}×{{ t.heightMm }} mm · {{ 'barcodes.symbologies.' + t.symbology | transloco }}
                  @if (t.isDefault) {
                    · {{ 'barcodes.default' | transloco }}
                  }
                </span>
              </button>
            </li>
          }
        </ul>
      </div>

      <form class="grid gap-4 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-2 dark:border-slate-700 dark:bg-slate-900" (ngSubmit)="save()">
        <div class="space-y-4">
          <label class="block text-sm">
            <span class="mb-1 block font-medium">{{ 'barcodes.templateName' | transloco }} *</span>
            <input
              name="name"
              class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3"
              [ngModel]="draft().name"
              (ngModelChange)="patch({ name: $event })"
            />
          </label>

          <label class="block text-sm">
            <span class="mb-1 block font-medium">{{ 'barcodes.sizePreset' | transloco }}</span>
            <select
              name="preset"
              class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3"
              [ngModel]="presetKey()"
              (ngModelChange)="applyPreset($event)"
            >
              @for (p of presets; track p.key) {
                <option [value]="p.key">{{ p.widthMm }} × {{ p.heightMm }} mm</option>
              }
              <option value="custom">{{ 'barcodes.customSize' | transloco }}</option>
            </select>
          </label>

          <div class="grid grid-cols-2 gap-3">
            <label class="block text-sm">
              <span class="mb-1 block font-medium">{{ 'barcodes.widthMm' | transloco }}</span>
              <input
                name="w"
                type="number"
                min="20"
                max="150"
                class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3"
                [ngModel]="draft().widthMm"
                (ngModelChange)="patch({ widthMm: +$event })"
              />
            </label>
            <label class="block text-sm">
              <span class="mb-1 block font-medium">{{ 'barcodes.heightMm' | transloco }}</span>
              <input
                name="h"
                type="number"
                min="10"
                max="150"
                class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3"
                [ngModel]="draft().heightMm"
                (ngModelChange)="patch({ heightMm: +$event })"
              />
            </label>
          </div>

          <label class="block text-sm">
            <span class="mb-1 block font-medium">{{ 'barcodes.symbology' | transloco }}</span>
            <select
              name="sym"
              class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3"
              [ngModel]="draft().symbology"
              (ngModelChange)="patch({ symbology: $event })"
            >
              @for (s of symbologies; track s) {
                <option [value]="s">{{ 'barcodes.symbologies.' + s | transloco }}</option>
              }
            </select>
          </label>

          <fieldset class="text-sm">
            <legend class="mb-1 font-medium">{{ 'barcodes.fields' | transloco }}</legend>
            @for (f of fieldList; track f) {
              <label class="flex min-h-11 items-center gap-2">
                <input type="checkbox" class="size-5" [name]="'f-' + f" [ngModel]="draft().fields.includes(f)" (ngModelChange)="toggleField(f, $event)" />
                {{ 'barcodes.fieldNames.' + f | transloco }}
              </label>
            }
          </fieldset>

          <label class="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" class="size-5" name="logo" [ngModel]="draft().showLogo" (ngModelChange)="patch({ showLogo: $event })" />
            {{ 'barcodes.showLogo' | transloco }}
          </label>
          <label class="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" class="size-5" name="def" [ngModel]="draft().isDefault" (ngModelChange)="patch({ isDefault: $event })" />
            {{ 'barcodes.makeDefault' | transloco }}
          </label>
        </div>

        <div class="space-y-3">
          <p class="text-sm font-medium">{{ 'barcodes.livePreview' | transloco }}</p>
          <div class="overflow-auto rounded-lg bg-slate-100 p-4 dark:bg-slate-800">
            @if (preview(); as p) {
              <div class="mx-auto overflow-hidden border border-dashed border-slate-400 bg-white text-black" [style.width.mm]="draft().widthMm" [style.height.mm]="draft().heightMm">
                <div class="lbl-preview" [innerHTML]="p"></div>
              </div>
            } @else {
              <p class="text-sm text-red-600">{{ 'barcodes.errors.previewFailed' | transloco }}</p>
            }
          </div>

          @if (error(); as msg) {
            <p role="alert" class="text-sm text-red-600">{{ msg }}</p>
          }

          <div class="flex flex-wrap justify-end gap-2">
            @if (editingId() !== null && !draft().isDefault) {
              <button type="button" class="min-h-12 rounded-lg border border-red-600 px-5 text-red-600" (click)="remove()">
                {{ 'common.delete' | transloco }}
              </button>
            }
            <button type="submit" class="min-h-12 rounded-lg bg-[#2563EB] px-5 font-medium text-white disabled:opacity-50" [disabled]="saving()">
              {{ 'common.save' | transloco }}
            </button>
          </div>
        </div>
      </form>
    </div>
  `,
  styles: [':host ::ng-deep .lbl-preview .lbl { page-break-after: auto; }'],
})
export class LabelDesignerComponent {
  readonly templates = input<LabelTemplate[]>([]);
  readonly sample = input.required<LabelItem>();
  readonly context = input.required<LabelContext>();
  readonly changed = output<void>();

  private readonly api = inject(LabelsService);
  private readonly i18n = inject(TranslocoService);
  private readonly dialogs = inject(ConfirmDialogService);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly presets = SIZE_PRESETS;
  protected readonly symbologies = SYMBOLOGIES;
  protected readonly fieldList = LABEL_FIELDS;

  protected readonly draft = signal<LabelTemplateInput>({ ...EMPTY });
  protected readonly editingId = signal<number | null>(null);
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly preview = signal<SafeHtml | null>(null);

  constructor() {
    // Draft, sample ya context badle to preview dobara banao
    effect(() => {
      const d = this.draft();
      const item = this.sample();
      const ctx = this.context();
      void this.render(d, item, ctx);
    });
  }

  protected presetKey(): string {
    const d = this.draft();
    return SIZE_PRESETS.find((p) => p.widthMm === d.widthMm && p.heightMm === d.heightMm)?.key ?? 'custom';
  }

  edit(t: LabelTemplate | null): void {
    this.error.set(null);
    this.editingId.set(t?.id ?? null);
    this.draft.set(t ? { name: t.name, widthMm: t.widthMm, heightMm: t.heightMm, symbology: t.symbology, fields: [...t.fields], showLogo: t.showLogo, isDefault: t.isDefault } : { ...EMPTY, fields: [...EMPTY.fields] });
  }

  protected patch(p: Partial<LabelTemplateInput>): void {
    this.draft.update((d) => ({ ...d, ...p }));
  }

  protected applyPreset(key: string): void {
    const p = SIZE_PRESETS.find((x) => x.key === key);
    if (p) this.patch({ widthMm: p.widthMm, heightMm: p.heightMm });
  }

  protected toggleField(f: LabelField, on: boolean): void {
    const fields = this.draft().fields.filter((x) => x !== f);
    // Tarteeb hamesha LABEL_FIELDS wali rahe
    this.patch({ fields: LABEL_FIELDS.filter((x) => (x === f ? on : fields.includes(x))) });
  }

  private async render(d: LabelTemplateInput, item: LabelItem, ctx: LabelContext): Promise<void> {
    if (draftError(d) === 'barcodes.errors.size') {
      this.preview.set(null);
      return;
    }
    // QR/EAN ke liye sample value na chale to ek misali value
    const value = d.symbology === 'ean13' ? '590123412345' : item.value;
    try {
      const svg = await barcodeSvg(value, d.symbology);
      const t: LabelTemplate = { ...d, id: 0 };
      const html = `<style>${labelCss(t)}</style>` + labelsBody(t, [{ item: { ...item, value }, svg, copies: 1 }], ctx);
      this.preview.set(this.sanitizer.bypassSecurityTrustHtml(html));
    } catch {
      this.preview.set(null);
    }
  }

  protected async save(): Promise<void> {
    const d = { ...this.draft(), name: this.draft().name.trim() };
    const key = draftError(d);
    if (key) {
      this.error.set(this.i18n.translate(key));
      return;
    }
    this.saving.set(true);
    this.error.set(null);
    try {
      const id = this.editingId();
      const saved = await firstValueFrom(id === null ? this.api.createTemplate(d) : this.api.updateTemplate(id, d));
      this.editingId.set(saved.id);
      this.changed.emit();
    } catch (e) {
      const err = e as { error?: { message?: string } };
      this.error.set(err.error?.message ?? this.i18n.translate('errors.generic'));
    } finally {
      this.saving.set(false);
    }
  }

  protected async remove(): Promise<void> {
    const id = this.editingId();
    if (id === null) return;
    const yes = await this.dialogs.confirm({
      title: this.i18n.translate('barcodes.deleteTitle'),
      message: this.i18n.translate('barcodes.deleteMessage', { name: this.draft().name }),
      confirmLabel: this.i18n.translate('common.delete'),
      cancelLabel: this.i18n.translate('common.cancel'),
      danger: true,
    });
    if (!yes) return;
    try {
      await firstValueFrom(this.api.deleteTemplate(id));
      this.edit(null);
      this.changed.emit();
    } catch (e) {
      const err = e as { error?: { message?: string } };
      this.error.set(err.error?.message ?? this.i18n.translate('errors.generic'));
    }
  }
}
