import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  linkedSignal,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ApprovalRequestDialogService } from './approval-request-dialog.service';

@Component({
  selector: 'app-approval-request-dialog',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dlg
      class="w-[calc(100%-2rem)] max-w-md rounded-xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/60 dark:bg-slate-900 dark:text-slate-100"
      aria-labelledby="approval-title"
      aria-describedby="approval-action"
      (cancel)="onCancel($event)"
    >
      @if (svc.pending(); as p) {
        <div class="p-5">
          <h2 id="approval-title" class="mb-2 text-lg font-semibold">{{ 'common.approval.title' | transloco }}</h2>
          <p id="approval-action" class="mb-4 text-sm font-medium text-slate-700 dark:text-slate-200">{{ p.action }}</p>
          <label for="approval-reason" class="mb-1 block text-sm font-medium">
            {{ 'common.reason.label' | transloco }}
          </label>
          <textarea
            id="approval-reason"
            rows="3"
            maxlength="500"
            class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent p-3 text-sm"
            aria-describedby="approval-hint"
            [value]="text()"
            (input)="onInput($event)"
          ></textarea>
          <p id="approval-hint" class="mt-1 text-xs text-slate-500">
            {{ 'common.reason.minHint' | transloco: { min: p.minLength } }}
          </p>
        </div>
        <div class="flex flex-col-reverse gap-2 border-t border-slate-200 p-4 sm:flex-row sm:justify-end dark:border-slate-700">
          <button
            type="button"
            class="min-h-12 rounded-lg border border-slate-300 px-4 font-medium dark:border-slate-600"
            (click)="svc.answer(null)"
          >
            {{ 'common.cancel' | transloco }}
          </button>
          <button
            type="button"
            class="min-h-12 rounded-lg bg-[#2563EB] px-4 font-medium text-white disabled:opacity-50"
            [disabled]="!valid()"
            (click)="onSubmit()"
          >
            {{ 'common.approval.submit' | transloco }}
          </button>
        </div>
      }
    </dialog>
  `,
})
export class ApprovalRequestDialogComponent {
  protected readonly svc = inject(ApprovalRequestDialogService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  protected readonly text = linkedSignal({ source: this.svc.pending, computation: () => '' });
  protected readonly valid = computed(() => {
    const p = this.svc.pending();
    return p !== null && this.text().trim().length >= p.minLength;
  });

  constructor() {
    effect(() => {
      const el = this.dlg().nativeElement;
      const open = this.svc.pending() !== null;
      if (open && !el.open) el.showModal();
      if (!open && el.open) el.close();
    });
  }

  protected onInput(event: Event): void {
    this.text.set((event.target as HTMLTextAreaElement).value);
  }

  protected onSubmit(): void {
    if (!this.valid()) return;
    this.svc.answer(this.text().trim());
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    this.svc.answer(null);
  }
}