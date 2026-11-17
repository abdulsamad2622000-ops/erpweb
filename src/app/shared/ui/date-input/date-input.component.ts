import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** Date field. Value is "YYYY-MM-DD" or null (no time zone problems). */
@Component({
  selector: 'app-date-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DateInputComponent),
      multi: true,
    },
  ],
  template: `
    <input
      [id]="inputId()"
      type="date"
      class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm"
      [value]="text()"
      [disabled]="disabled()"
      [attr.min]="min() || null"
      [attr.max]="max() || null"
      [attr.aria-describedby]="describedBy() || null"
      (input)="onInput($event)"
      (blur)="onTouched()"
    />
  `,
})
export class DateInputComponent implements ControlValueAccessor {
  readonly inputId = input.required<string>();
  /** "YYYY-MM-DD" */
  readonly min = input<string>('');
  readonly max = input<string>('');
  readonly describedBy = input<string>('');

  protected readonly text = signal('');
  protected readonly disabled = signal(false);

  private onChange: (value: string | null) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  writeValue(value: string | null): void {
    this.text.set(value ?? '');
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected onInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.text.set(raw);
    this.onChange(raw === '' ? null : raw);
  }
}