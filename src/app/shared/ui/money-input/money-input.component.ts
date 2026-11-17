import { ChangeDetectionStrategy, Component, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { normalizeMoney } from '../../utils/money';

function sanitize(raw: string): string {
  const cleaned = raw.replace(/[^\d.]/g, '');
  const [intPart, ...rest] = cleaned.split('.');
  return rest.length ? `${intPart}.${rest.join('').slice(0, 2)}` : intPart;
}

/** Money field. Value is a decimal string ("1250.50") or null. Put it inside <app-form-field>. */
@Component({
  selector: 'app-money-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => MoneyInputComponent),
      multi: true,
    },
  ],
  template: `
    <div class="relative">
      <span
        class="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-sm text-slate-500"
        aria-hidden="true"
        >{{ currency() }}</span
      >
      <input
        [id]="inputId()"
        type="text"
        inputmode="decimal"
        autocomplete="off"
        class="min-h-11 w-full rounded-lg border border-slate-400 bg-transparent ps-14 pe-3 text-end text-sm"
        [value]="text()"
        [disabled]="disabled()"
        [placeholder]="placeholder()"
        [attr.aria-describedby]="describedBy() || null"
        (input)="onInput($event)"
        (blur)="onBlur()"
      />
    </div>
  `,
})
export class MoneyInputComponent implements ControlValueAccessor {
  readonly inputId = input.required<string>();
  readonly currency = input<string>('PKR');
  readonly placeholder = input<string>('0.00');
  readonly describedBy = input<string>('');

  protected readonly text = signal('');
  protected readonly disabled = signal(false);

  private onChange: (value: string | null) => void = () => undefined;
  private onTouched: () => void = () => undefined;

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
    const el = event.target as HTMLInputElement;
    const clean = sanitize(el.value);
    if (el.value !== clean) el.value = clean;
    this.text.set(clean);
    this.onChange(clean === '' ? null : clean.replace(/\.$/, ''));
  }

  protected onBlur(): void {
    const n = normalizeMoney(this.text());
    if (n !== null) {
      this.text.set(n);
      this.onChange(n);
    }
    this.onTouched();
  }
}