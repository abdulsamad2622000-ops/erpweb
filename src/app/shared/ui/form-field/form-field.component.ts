import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  signal,
} from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-form-field',
  imports: [TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-1.5">
      <label [attr.for]="inputId()" class="text-sm font-medium text-slate-900 dark:text-slate-100">
        {{ label() }}
        @if (required()) {
          <span class="ms-1 text-red-600" aria-hidden="true">*</span>
          <span class="sr-only">{{ 'common.required' | transloco }}</span>
        }
      </label>

      <!-- Yahan input / p-select / p-inputnumber project hota hai.
           Us par id = inputId set karein. -->
      <ng-content />

      @if (hint() && !errorMessage()) {
        <p [id]="hintId()" class="text-xs text-slate-600 dark:text-slate-400">{{ hint() }}</p>
      }
      @if (errorMessage(); as msg) {
        <p [id]="errorId()" role="alert" class="flex items-center gap-1 text-xs text-red-600">
          <i class="pi pi-exclamation-circle" aria-hidden="true"></i>
          <span>{{ msg | transloco }}</span>
        </p>
      }
    </div>
  `,
})
export class FormFieldComponent {
  readonly label = input.required<string>();
  readonly inputId = input.required<string>();
  readonly control = input.required<AbstractControl>();
  readonly hint = input<string>('');
  readonly required = input<boolean>(false);

  // Control ke events par signal update hota hai taake OnPush mein bhi error nazar aaye.
  private readonly version = signal(0);

  constructor() {
    effect((onCleanup) => {
      const sub = this.control().events.subscribe(() => this.version.update((v) => v + 1));
      onCleanup(() => sub.unsubscribe());
    });
  }

  protected readonly hintId = computed(() => `${this.inputId()}-hint`);
  protected readonly errorId = computed(() => `${this.inputId()}-error`);

  /** Input par aria-describedby ke liye parent ye id use kare. */
  readonly describedBy = computed(() => (this.errorMessage() ? this.errorId() : this.hintId()));

  protected readonly errorMessage = computed<string | null>(() => {
    this.version();
    const c = this.control();
    if (!c.invalid || !(c.touched || c.dirty)) return null;
    const errors = c.errors ?? {};
    // Backend (422) ka message 'server' key mein aa sakta hai.
    const server = errors['server'];
    if (typeof server === 'string') return server;
    if (errors['required']) return 'common.errors.required';
    if (errors['email']) return 'common.errors.email';
    if (errors['minlength']) return 'common.errors.minlength';
    if (errors['maxlength']) return 'common.errors.maxlength';
    if (errors['pattern']) return 'common.errors.pattern';
    if (errors['min']) return 'common.errors.min';
    if (errors['max']) return 'common.errors.max';
    return 'common.errors.invalid';
  });
}
