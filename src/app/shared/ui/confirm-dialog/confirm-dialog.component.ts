import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
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
      class="w-[calc(100%-2rem)] max-w-md rounded-xl bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-900/60 dark:bg-slate-900 dark:text-slate-100"
      aria-labelledby="confirm-title"
      aria-describedby="confirm-message"
      (cancel)="onCancel($event)"
    >
      @if (svc.pending(); as p) {
        <div class="p-5">
          <h2 id="confirm-title" class="mb-2 text-lg font-semibold">{{ p.title }}</h2>
          <p id="confirm-message" class="text-sm text-slate-600 dark:text-slate-300">{{ p.message }}</p>
        </div>
        <div class="flex flex-col-reverse gap-2 border-t border-slate-200 p-4 sm:flex-row sm:justify-end dark:border-slate-700">
          <button
            type="button"
            class="min-h-12 rounded-lg border border-slate-300 px-4 font-medium dark:border-slate-600"
            (click)="svc.answer(false)"
          >
            {{ p.cancelLabel ?? ('common.cancel' | transloco) }}
          </button>
          <button
            type="button"
            class="min-h-12 rounded-lg px-4 font-medium text-white"
            [class]="p.danger ? 'bg-red-600' : 'bg-[#2563EB]'"
            (click)="svc.answer(true)"
          >
            {{ p.confirmLabel ?? ('common.confirm' | transloco) }}
          </button>
        </div>
      }
    </dialog>
  `,
})
export class ConfirmDialogComponent {
  protected readonly svc = inject(ConfirmDialogService);
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  constructor() {
    effect(() => {
      const el = this.dlg().nativeElement;
      const open = this.svc.pending() !== null;
      if (open && !el.open) el.showModal();
      if (!open && el.open) el.close();
    });
  }

  protected onCancel(event: Event): void {
    // Esc dabane par.
    event.preventDefault();
    this.svc.answer(false);
  }
}
