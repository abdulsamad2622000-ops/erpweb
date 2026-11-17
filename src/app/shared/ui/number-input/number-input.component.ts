import { ChangeDetectionStrategy, Component, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/** Quantity / number field. Value is a number or null. Use Validators.min / max on the control. */
@Component({
  selector: 'app-number-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => NumberInputComponent),
      multi: true,
    },
  ],
  template: `
    <input
      [id]="inputId()"
      type="number"
      [attr.inputmode]="mode()"
      class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent px-3 text-end text-sm"
      [value]="text()"
      [disabled]="disabled()"
      [placeholder]="placeholder()"
      [attr.min]="min() ?? null"
      [attr.max]="max() ?? null"
      [attr.step]="step()"
      [attr.aria-describedby]="describedBy() || null"
      (input)="onInput($event)"
      (blur)="onTouched()"
    />
  `,
})
export class NumberInputComponent implements ControlValueAccessor {
  readonly inputId = input.required<string>();
  readonly min = input<number | undefined>(undefined);
  readonly max = input<number | undefined>(undefined);
  readonly step = input<number>(1);
  readonly placeholder = input<string>('');
  readonly describedBy = input<string>('');

  protected readonly mode = computed(() => (Number.isInteger(this.step()) ? 'numeric' : 'decimal'));
  protected readonly text = signal('');
  protected readonly disabled = signal(false);

  private onChange: (value: number | null) => void = () => undefined;
  protected onTouched: () => void = () => undefined;

  writeValue(value: number | null): void {
    this.text.set(value === null || value === undefined ? '' : String(value));
  }

  registerOnChange(fn: (value: number | null) => void): void {
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
    const n = raw === '' ? null : Number(raw);
    this.onChange(n === null || Number.isNaN(n) ? null : n);
  }
}