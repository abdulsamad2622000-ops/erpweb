import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';

/** Date input. Value ISO string "yyyy-mm-dd" ya null. min/max bhi ISO string. */
@Component({
  selector: 'app-date-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => DateInputComponent), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => DateInputComponent), multi: true },
  ],
  template: `
    <input
      [id]="inputId()"
      type="date"
      [value]="value()"
      [disabled]="disabled()"
      [attr.min]="min() || null"
      [attr.max]="max() || null"
      [attr.aria-describedby]="describedBy() || null"
      class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-sm dark:[color-scheme:dark]"
      (input)="onInput($event)"
      (blur)="onTouched()" />
  `,
})
export class DateInputComponent implements ControlValueAccessor, Validator {
  readonly inputId = input.required<string>();
  readonly min = input('');
  readonly max = input('');
  readonly describedBy = input('');

  protected readonly value = signal('');
  protected readonly disabled = signal(false);

  private onChange: (v: string | null) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  writeValue(v: string | null): void {
    this.value.set(typeof v === 'string' ? v : '');
  }
  registerOnChange(fn: (v: string | null) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(d: boolean): void {
    this.disabled.set(d);
  }

  validate(c: AbstractControl): ValidationErrors | null {
    const v = c.value as string | null;
    if (!v) return null;
    const min = this.min();
    const max = this.max();
    if (min && v < min) return { min: { min, actual: v } };
    if (max && v > max) return { max: { max, actual: v } };
    return null;
  }

  protected onInput(e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    this.value.set(v);
    this.onChange(v === '' ? null : v);
  }
}