import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * Native <dialog> shell for create/edit forms.
 * Parent projects its form fields and calls open()/close().
 * Validation stays in the parent: it handles (save).
 */
@Component({
  selector: 'app-crud-dialog',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dlg
      class="m-auto rounded-xl border border-slate-300 bg-white p-0 text-slate-900 backdrop:bg-black/40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      [attr.aria-labelledby]="titleId"
      (close)="closed.emit()"
    >
      <form (submit)="onSubmit($event)" class="w-[min(92vw,26rem)] space-y-4 p-5">
        <h2 [id]="titleId" class="text-lg font-semibold">{{ title() }}</h2>

        <ng-content />

        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="min-h-12 rounded-lg border border-slate-400 px-5"
            (click)="close()"
          >
            {{ 'common.cancel' | transloco }}
          </button>
          <button
            type="submit"
            class="min-h-12 rounded-lg bg-[#2563EB] px-5 font-medium text-white disabled:opacity-50"
            [disabled]="saving()"
          >
            {{ 'common.save' | transloco }}
          </button>
        </div>
      </form>
    </dialog>
  `,
})
export class CrudDialogComponent {
  readonly title = input.required<string>();
  readonly saving = input<boolean>(false);

  readonly save = output<void>();
  readonly closed = output<void>();

  protected readonly titleId = 'crud-dialog-title';
  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');

  open(): void {
    const el = this.dlg().nativeElement;
    if (!el.open) el.showModal();
  }

  close(): void {
    const el = this.dlg().nativeElement;
    if (el.open) el.close();
  }

  protected onSubmit(event: Event): void {
    event.preventDefault();
    this.save.emit();
  }
}