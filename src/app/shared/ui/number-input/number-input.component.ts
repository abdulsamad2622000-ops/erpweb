import { ChangeDetectionStrategy, Component, computed, forwardRef, input, signal } from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { formatNumber, parseNumber, roundTo } from './number-utils';

/**
 * Number aur money input. Reactive forms ke saath chalta hai (value: number | null).
 * Money: prefix="Rs" [decimals]="2" [min]="0"
 * Focus par sada number, blur par "1,250.50" format. Ghalat text par control mein 'pattern' error.
 */
@Component({
  selector: 'app-number-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    { provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => NumberInputComponent), multi: true },
    { provide: NG_VALIDATORS, useExisting: forwardRef(() => NumberInputComponent), multi: true },
  ],
  template: `
    <div
      class="flex min-h-11 w-full items-center rounded-lg border border-slate-400 bg-transparent focus-within:outline-2 focus-within:outline-accent"
      [class.opacity-50]="disabled()">
      @if (prefix()) {
        <span class="ps-3 text-sm text-slate-600 dark:text-slate-400" aria-hidden="true">{{ prefix() }}</span>
      }
      <input
        [id]="inputId()"
        type="text"
        autocomplete="off"
        [attr.inputmode]="decimals() > 0 ? 'decimal' : 'numeric'"
        [attr.placeholder]="placeholder() || null"
        [attr.aria-describedby]="describedBy() || null"
        [attr.aria-invalid]="invalid() ? 'true' : null"
        class="min-h-11 w-full bg-transparent px-3 text-end text-sm tabular-nums outline-none"
        [value]="display()"
        [disabled]="disabled()"
        (input)="onInput($event)"
        (focus)="onFocus()"
        (blur)="onBlur()" />
    </div>
  `,
})
export class NumberInputComponent implements ControlValueAccessor, Validator {
  readonly inputId = input.required<string>();
  readonly decimals = input(0);
  readonly min = input<number | null>(null);
  readonly max = input<number | null>(null);
  readonly prefix = input('');
  readonly placeholder = input('');
  readonly describedBy = input('');

  protected readonly disabled = signal(false);
  protected readonly invalid = signal(false);
  private readonly value = signal<number | null>(null);
  private readonly editText = signal<string | null>(null);

  protected readonly display = computed(() => {
    const e = this.editText();
    if (e !== null) return e;
    const v = this.value();
    return v === null ? '' : formatNumber(v, this.decimals());
  });

  private onChange: (v: number | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(v: number | null): void {
    this.value.set(typeof v === 'number' && Number.isFinite(v) ? v : null);
    this.editText.set(null);
    this.invalid.set(false);
  }
  registerOnChange(fn: (v: number | null) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(d: boolean): void {
    this.disabled.set(d);
  }

  validate(c: AbstractControl): ValidationErrors | null {
    if (this.invalid()) return { pattern: true };
    const v = c.value as number | null;
    if (v === null || v === undefined) return null;
    const min = this.min();
    const max = this.max();
    if (min !== null && v < min) return { min: { min, actual: v } };
    if (max !== null && v > max) return { max: { max, actual: v } };
    return null;
  }

  protected onInput(e: Event): void {
    const raw = (e.target as HTMLInputElement).value;
    this.editText.set(raw);
    const parsed = parseNumber(raw);
    if (parsed === null) {
      this.invalid.set(false);
      this.value.set(null);
    } else if (Number.isNaN(parsed)) {
      this.invalid.set(true);
      this.value.set(null);
    } else {
      this.invalid.set(false);
      this.value.set(roundTo(parsed, this.decimals()));
    }
    this.onChange(this.value());
  }

  protected onFocus(): void {
    const v = this.value();
    if (this.editText() === null && v !== null) {
      this.editText.set(String(roundTo(v, this.decimals())));
    }
  }

  protected onBlur(): void {
    this.onTouched();
    if (!this.invalid()) this.editText.set(null);
  }
}