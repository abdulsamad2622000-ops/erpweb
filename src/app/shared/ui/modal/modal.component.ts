import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';

export type ModalSize = 'sm' | 'md' | 'lg';
const MODAL_WIDTH: Record<ModalSize, string> = { sm: '26rem', md: '32rem', lg: '40rem' };

/**
 * Native <dialog> (showModal) ka card-style shell: screen ke beech mein, Esc se band hone ki darkhwast,
 * background band (focus andar hi rehta hai), aur band hone par focus wapas pichle element par.
 * Dialog kab band ho, ye parent tay karta hai: (closed) par apni state badle. Parent na badle to dialog khula rehta hai.
 */
@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dialog
      #dlg
      class="rounded-2xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-900/60 dark:bg-slate-900 dark:text-slate-100"
      [style.--dialog-w]="width()"
      [attr.aria-labelledby]="labelledBy()"
    >
      <div class="p-5"><ng-content /></div>
    </dialog>
  `,
})
export class ModalComponent implements AfterViewInit, OnDestroy {
  /** Dialog ke heading ka id. */
  readonly labelledBy = input.required<string>();
  readonly size = input<ModalSize>('md');
  /** Bahar (backdrop) click se band karne ki darkhwast. Form wale dialogs mein band rakhein. */
  readonly backdropClose = input(false);
  /** Esc ya backdrop click par. */
  readonly closed = output<void>();

  private readonly dlg = viewChild.required<ElementRef<HTMLDialogElement>>('dlg');
  protected readonly width = computed(() => MODAL_WIDTH[this.size()]);

  private el: HTMLDialogElement | null = null;
  private opener: HTMLElement | null = null;
  private downOnBackdrop = false;

  private readonly onCancel = (e: Event): void => {
    // Esc: browser ko khud band karne se roko, parent state se band karega.
    e.preventDefault();
    this.closed.emit();
  };
  private readonly onDown = (e: Event): void => {
    this.downOnBackdrop = e.target === this.el;
  };
  private readonly onClick = (e: Event): void => {
    const hit = this.downOnBackdrop && e.target === this.el;
    this.downOnBackdrop = false;
    if (hit && this.backdropClose()) this.closed.emit();
  };

  ngAfterViewInit(): void {
    const el = this.dlg().nativeElement;
    this.el = el;
    el.addEventListener('cancel', this.onCancel);
    el.addEventListener('mousedown', this.onDown);
    el.addEventListener('click', this.onClick);
    const active = document.activeElement;
    this.opener = active instanceof HTMLElement ? active : null;
    if (typeof (el as Partial<HTMLDialogElement>).showModal === 'function') el.showModal();
    else el.setAttribute('open', '');
  }

  ngOnDestroy(): void {
    const el = this.el;
    if (el) {
      el.removeEventListener('cancel', this.onCancel);
      el.removeEventListener('mousedown', this.onDown);
      el.removeEventListener('click', this.onClick);
      if (el.hasAttribute('open')) {
        if (typeof (el as Partial<HTMLDialogElement>).close === 'function') el.close();
        else el.removeAttribute('open');
      }
    }
    if (this.opener?.isConnected) this.opener.focus();
  }
}