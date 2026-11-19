import { ChangeDetectionStrategy, Component, OnInit, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';
import { FormFieldComponent } from '../../../shared/ui/form-field/form-field.component';
import { LabelField, LabelKind, LabelTemplate, LabelTemplateInput, Symbology } from '../models/label.models';
import { LabelsService } from '../services/labels.service';
import { moneyPkr, renderLabelSheet } from '../utils/label-render';
import { ALL_FIELDS, SIZE_PRESETS } from '../utils/label-utils';
import { SAMPLE_ITEMS } from '../utils/sample-items';

const EMPTY: LabelTemplateInput = {
  name: '', kind: 'serial', widthMm: 62, heightMm: 32, symbology: 'code128',
  fields: ['name', 'specs', 'serial'], showLogo: false, isDefault: false,
};

@Component({
  selector: 'app-label-templates-page',
  imports: [ReactiveFormsModule, RouterLink, TranslocoPipe, FormFieldComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="mx-auto max-w-6xl space-y-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-xl font-semibold">{{ 'labels.templates' | transloco }}</h1>
        <a routerLink=".." class="inline-flex min-h-11 items-center rounded-lg border border-slate-400 px-4 text-sm">
          {{ 'labels.back' | transloco }}
        </a>
      </div>

      <div class="grid gap-4 lg:grid-cols-[16rem_1fr]">
        <nav class="space-y-2" [attr.aria-label]="'labels.templates' | transloco">
          <button type="button" class="min-h-11 w-full rounded-lg border border-dashed border-slate-400 px-3 text-start text-sm" (click)="edit(null)">
            + {{ 'labels.newTemplate' | transloco }}
          </button>
          @for (t of templates(); track t.id) {
            <button type="button" class="min-h-11 w-full rounded-lg border px-3 py-2 text-start text-sm"
                    [class]="editingId() === t.id ? 'border-[#1E3A8A] bg-blue-50 dark:bg-slate-800' : 'border-slate-300'"
                    (click)="edit(t)">
              <span class="block font-medium">{{ t.name }}</span>
              <span class="text-xs text-slate-500">{{ 'labels.kinds.' + t.kind | transloco }} · {{ t.widthMm }}×{{ t.heightMm }} mm{{ t.isDefault ? ' · ★' : '' }}</span>
            </button>
          }
        </nav>

        <div [formGroup]="form" class="space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <div class="grid gap-4 sm:grid-cols-2">
            <app-form-field [label]="'common.name' | transloco" inputId="tpl-name" [control]="form.controls.name" [required]="true">
              <input id="tpl-name" formControlName="name" class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm" />
            </app-form-field>
            <div>
              <label for="tpl-kind" class="mb-1 block text-sm">{{ 'labels.labelFor' | transloco }}</label>
              <select id="tpl-kind" formControlName="kind" class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm">
                @for (k of kinds; track k) { <option [value]="k">{{ 'labels.kinds.' + k | transloco }}</option> }
              </select>
            </div>
          </div>

          <fieldset>
            <legend class="mb-1 text-sm">{{ 'labels.size' | transloco }}</legend>
            <div class="flex flex-wrap items-center gap-2">
              @for (p of presets; track p.key) {
                <button type="button" class="min-h-11 rounded-lg border px-3 text-sm"
                        [class]="value().widthMm === p.widthMm && value().heightMm === p.heightMm ? 'border-[#1E3A8A] bg-[#1E3A8A] text-white' : 'border-slate-400'"
                        (click)="form.patchValue({ widthMm: p.widthMm, heightMm: p.heightMm })">
                  {{ p.widthMm }}×{{ p.heightMm }}
                </button>
              }
              <label class="ms-2 flex items-center gap-1 text-sm">W
                <input type="number" formControlName="widthMm" min="20" max="150" class="min-h-11 w-20 rounded-lg border border-slate-400 bg-transparent px-2" />
              </label>
              <label class="flex items-center gap-1 text-sm">H
                <input type="number" formControlName="heightMm" min="15" max="150" class="min-h-11 w-20 rounded-lg border border-slate-400 bg-transparent px-2" />
              </label>
              <span class="text-sm text-slate-500">mm</span>
            </div>
          </fieldset>

          <div>
            <label for="tpl-sym" class="mb-1 block text-sm">{{ 'labels.barcodeType' | transloco }}</label>
            <select id="tpl-sym" formControlName="symbology" class="min-h-11 rounded-lg border border-slate-400 bg-transparent px-3 text-sm">
              @for (s of symbologies; track s) { <option [value]="s">{{ 'labels.symbologies.' + s | transloco }}</option> }
            </select>
            @if (value().symbology === 'ean13') {
              <p class="mt-1 text-xs text-slate-600 dark:text-slate-400">{{ 'labels.eanHint' | transloco }}</p>
            }
          </div>

          <fieldset>
            <legend class="mb-1 text-sm">{{ 'labels.fields' | transloco }}</legend>
            <div class="flex flex-wrap gap-3">
              @for (f of allFields; track f) {
                <label class="flex min-h-11 items-center gap-2 text-sm">
                  <input type="checkbox" class="size-5" [checked]="value().fields.includes(f)" (change)="toggleField(f)" />
                  {{ 'labels.fieldNames.' + f | transloco }}
                </label>
              }
            </div>
          </fieldset>

          <div class="flex flex-wrap gap-4">
            <label class="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" formControlName="showLogo" class="size-5" /> {{ 'labels.showLogo' | transloco }}
            </label>
            <label class="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" formControlName="isDefault" class="size-5" /> {{ 'labels.isDefault' | transloco }}
            </label>
          </div>

          <div>
            <h2 class="mb-2 text-sm font-semibold">{{ 'labels.livePreview' | transloco }}</h2>
            <div class="overflow-x-auto rounded-lg border border-slate-200 bg-white p-3 text-black" [innerHTML]="preview()"></div>
          </div>

          @if (saveError(); as e) { <p role="alert" class="text-sm text-red-600">{{ e }}</p> }
          @if (saved()) { <p role="status" class="text-sm text-green-700">{{ 'labels.saved' | transloco }}</p> }
          <button type="button" class="min-h-11 rounded-lg bg-[#1E3A8A] px-5 text-sm text-white disabled:opacity-50"
                  [disabled]="saving()" (click)="save()">
            {{ 'common.save' | transloco }}
          </button>
        </div>
      </div>
    </section>
  `,
})
export class LabelTemplatesPage implements OnInit {
  private readonly api = inject(LabelsService);
  private readonly fb = inject(FormBuilder);
  private readonly i18n = inject(TranslocoService);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly kinds: LabelKind[] = ['serial', 'sku', 'bin'];
  protected readonly symbologies: Symbology[] = ['code128', 'qr', 'ean13'];
  protected readonly presets = SIZE_PRESETS;
  protected readonly allFields = ALL_FIELDS;

  protected readonly templates = signal<LabelTemplate[]>([]);
  protected readonly editingId = signal<number | null>(null);
  protected readonly preview = signal<SafeHtml | null>(null);
  protected readonly saving = signal(false);
  protected readonly saved = signal(false);
  protected readonly saveError = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    name: [EMPTY.name, [Validators.required, Validators.maxLength(60)]],
    kind: [EMPTY.kind as LabelKind],
    widthMm: [EMPTY.widthMm, [Validators.required, Validators.min(20), Validators.max(150)]],
    heightMm: [EMPTY.heightMm, [Validators.required, Validators.min(15), Validators.max(150)]],
    symbology: [EMPTY.symbology as Symbology],
    fields: [EMPTY.fields as LabelField[]],
    showLogo: [EMPTY.showLogo],
    isDefault: [EMPTY.isDefault],
  });
  protected readonly value = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() }) as () => LabelTemplateInput;

  constructor() {
    effect(() => {
      const v = this.value();
      void this.renderPreview({ ...EMPTY, ...v, id: 0 } as LabelTemplate);
    });
  }

  ngOnInit(): void {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.templates.set(await firstValueFrom(this.api.templates()));
    } catch {
      this.saveError.set(this.i18n.translate('errors.generic'));
    }
  }

  protected edit(t: LabelTemplate | null): void {
    this.editingId.set(t?.id ?? null);
    this.saved.set(false);
    this.saveError.set(null);
    const { id: _id, ...rest } = t ?? { ...EMPTY, id: 0 };
    void _id;
    this.form.reset({ ...rest, fields: [...rest.fields] });
  }

  protected toggleField(f: LabelField): void {
    const cur = this.form.controls.fields.value;
    const next = cur.includes(f) ? cur.filter((x) => x !== f) : ALL_FIELDS.filter((x) => x === f || cur.includes(x));
    this.form.controls.fields.setValue(next);
  }

  protected async save(): Promise<void> {
    this.form.markAllAsTouched();
    this.saved.set(false);
    if (this.form.invalid) return;
    const v = this.form.getRawValue();
    if (v.fields.length === 0) {
      this.saveError.set(this.i18n.translate('labels.pickField'));
      return;
    }
    this.saving.set(true);
    this.saveError.set(null);
    const body: LabelTemplateInput = { ...v, name: v.name.trim(), widthMm: +v.widthMm, heightMm: +v.heightMm };
    try {
      const id = this.editingId();
      const res = await firstValueFrom(id === null ? this.api.createTemplate(body) : this.api.updateTemplate(id, body));
      await this.load();
      this.editingId.set(res.id);
      this.saved.set(true);
    } catch (e) {
      const msg = (e as { error?: { message?: string } })?.error?.message;
      this.saveError.set(msg ?? this.i18n.translate('errors.generic'));
    } finally {
      this.saving.set(false);
    }
  }

  private async renderPreview(t: LabelTemplate): Promise<void> {
    if (!(t.widthMm >= 20 && t.heightMm >= 15)) return;
    try {
      const html = await renderLabelSheet(t, [SAMPLE_ITEMS[t.kind]], { company: 'Company name', logoUrl: null, money: moneyPkr });
      this.preview.set(this.sanitizer.bypassSecurityTrustHtml(html));
    } catch {
      this.preview.set(null);
    }
  }
}
