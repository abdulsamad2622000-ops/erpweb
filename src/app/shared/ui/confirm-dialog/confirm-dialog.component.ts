import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ConfirmDialogService } from './confirm-dialog.service';

@Component({
  selector: 'app-confirm-dialog',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dlg
      class="w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/60 dark:bg-slate-900 dark:text-slate-100"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      (cancel)="onCancel($event)"
    >
      @if (svc.pending(); as p) {
        <div class="px-6 pt-8 text-center">
          <div
            class="mx-auto mb-4 flex size-16 items-center justify-center rounded-full"
            [class]="p.danger ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400' : 'bg-blue-100 text-[#2563EB] dark:bg-blue-950 dark:text-blue-400'"
            aria-hidden="true"
          >
            <i style="font-size: 2rem" [class]="p.danger ? 'pi pi-trash' : 'pi pi-question-circle'"></i>
          </div>
          <h2 id="confirm-title" class="mb-2 text-2xl font-bold">{{ p.title }}</h2>
          <p id="confirm-message" class="text-sm text-slate-600 dark:text-slate-300">{{ p.message }}</p>

          @if (p.kind === 'reason') {
            <div class="mt-5 flex flex-col gap-1.5 text-start">
              <label for="confirm-text" class="text-sm font-medium">
                {{ 'common.reason.label' | transloco }}
                <span class="ms-1 text-red-600" aria-hidden="true">*</span>
              </label>
              <textarea
                #box
                id="confirm-text"
                rows="3"
                class="min-h-24 w-full rounded-lg border border-slate-400 bg-transparent p-3 text-sm"
                aria-describedby="confirm-hint"
                [attr.aria-invalid]="showError() ? 'true' : null"
                [value]="text()"
                (input)="onText($event)"
                (blur)="touched.set(true)"
              ></textarea>
              <div class="flex items-center justify-between gap-2 text-xs">
                <p
                  id="confirm-hint"
                  [class]="showError() ? 'text-red-600' : 'text-slate-600 dark:text-slate-400'"
                >
                  {{ 'common.reason.hint' | transloco: { min: p.minLength } }}
                </p>
                <span aria-live="polite" class="text-slate-600 dark:text-slate-400">
                  {{ trimmedLength() }} / {{ p.minLength }}
                </span>
              </div>
            </div>
          }

          @if (p.kind === 'approval') {
            <div class="mt-5 flex flex-col gap-3 text-start">
              <div class="flex flex-col gap-1.5">
                <label for="confirm-text" class="text-sm font-medium">
                  {{ 'common.approval.noteLabel' | transloco }}
                </label>
                <textarea
                  #box
                  id="confirm-text"
                  rows="3"
                  class="min-h-24 w-full rounded-lg border border-slate-400 bg-transparent p-3 text-sm"
                  [value]="text()"
                  (input)="onText($event)"
                ></textarea>
              </div>
              <label class="flex min-h-11 items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  class="size-5"
                  [checked]="approved()"
                  (change)="onApproved($event)"
                />
                {{ 'common.approval.checkbox' | transloco }}
              </label>
            </div>
          }
        </div>

        <div class="mx-6 mt-6 flex gap-3 border-t border-slate-200 pb-6 pt-5 dark:border-slate-700">
          <button
            type="button"
            class="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 font-semibold dark:border-slate-600"
            (click)="svc.answer(false)"
          >
            <i class="pi pi-times" aria-hidden="true"></i>
            {{ p.cancelLabel ?? ('common.cancel' | transloco) }}
          </button>
          <button
            type="button"
            class="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-lg font-semibold text-white disabled:opacity-50"
            [class]="p.danger ? 'bg-red-600' : 'bg-[#2563EB]'"
            [disabled]="!canSubmit()"
            (click)="submit()"
          >
            <i [class]="p.danger ? 'pi pi-trash' : 'pi pi-check'" aria-hidden="true"></i>
            {{ p.confirmLabel ?? ('common.confirm' | transloco) }}
          </button>
        </div>

        <!-- Close (X): DOM mein aakhir mein, taake Cancel aur Confirm ka button order na badle. -->
        <button
          type="button"
          class="absolute end-3 top-3 inline-flex size-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          [attr.aria-label]="'common.cancel' | transloco"
          (click)="svc.answer(false)"
        >
          <i class="pi pi-times" style="font-size: 1.25rem" aria-hidden="true"></i>
        </button>
      }
    </dialog>
  `,
})
export class ConfirmDialogComponent {
  protected readonly svc = inject(ConfirmDialogService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  private readonly box = viewChild<ElementRef<HTMLTextAreaElement>>('box');

  protected readonly text = signal('');
  protected readonly approved = signal(false);
  protected readonly touched = signal(false);

  protected readonly trimmedLength = computed(() => this.text().trim().length);

  protected readonly canSubmit = computed(() => {
    const p = this.svc.pending();
    if (!p) return false;
    if (p.kind === 'reason') return this.trimmedLength() >= p.minLength;
    if (p.kind === 'approval') return this.approved();
    return true;
  });

  protected readonly showError = computed(() => {
    const p = this.svc.pending();
    return p?.kind === 'reason' && this.touched() && this.trimmedLength() < p.minLength;
  });

  constructor() {
    effect(() => {
      const el = this.dlg().nativeElement;
      const p = this.svc.pending();
      if (p && !el.open) {
        this.text.set('');
        this.approved.set(false);
        this.touched.set(false);
        el.showModal();
        setTimeout(() => this.box()?.nativeElement.focus());
      }
      if (!p && el.open) el.close();
    });
  }

  protected onText(event: Event): void {
    this.text.set((event.target as HTMLTextAreaElement).value);
  }

  protected onApproved(event: Event): void {
    this.approved.set((event.target as HTMLInputElement).checked);
  }

  protected submit(): void {
    if (!this.canSubmit()) {
      this.touched.set(true);
      return;
    }
    this.svc.answer(true, this.text());
  }

  protected onCancel(event: Event): void {
    // Esc dabane par.
    event.preventDefault();
    this.svc.answer(false);
  }
}