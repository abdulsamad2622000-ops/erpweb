import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { MoneyInputComponent } from './money-input.component';

function setup() {
  TestBed.configureTestingModule({ imports: [MoneyInputComponent] });
  const fixture = TestBed.createComponent(MoneyInputComponent);
  fixture.componentRef.setInput('inputId', 'price');
  fixture.detectChanges();
  const input = (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
  const onChange = vi.fn();
  const onTouched = vi.fn();
  fixture.componentInstance.registerOnChange(onChange);
  fixture.componentInstance.registerOnTouched(onTouched);
  return { fixture, input, onChange, onTouched };
}

function type(input: HTMLInputElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

describe('MoneyInput', () => {
  it('shows the written value and the currency', () => {
    const { fixture, input } = setup();
    fixture.componentInstance.writeValue('1250.50');
    fixture.detectChanges();
    expect(input.value).toBe('1250.50');
    expect(input.id).toBe('price');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('PKR');
  });

  it('strips letters and extra dots', () => {
    const { input, onChange } = setup();
    type(input, '12a3.4.5');
    expect(input.value).toBe('123.45');
    expect(onChange).toHaveBeenLastCalledWith('123.45');
  });

  it('keeps only two decimals', () => {
    const { input, onChange } = setup();
    type(input, '5.999');
    expect(input.value).toBe('5.99');
    expect(onChange).toHaveBeenLastCalledWith('5.99');
  });

  it('emits null when cleared', () => {
    const { input, onChange } = setup();
    type(input, '5');
    type(input, '');
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('pads to two decimals on blur and marks touched', () => {
    const { fixture, input, onChange, onTouched } = setup();
    type(input, '12.5');
    input.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(input.value).toBe('12.50');
    expect(onChange).toHaveBeenLastCalledWith('12.50');
    expect(onTouched).toHaveBeenCalled();
  });

  it('can be disabled', () => {
    const { fixture, input } = setup();
    fixture.componentInstance.setDisabledState(true);
    fixture.detectChanges();
    expect(input.disabled).toBe(true);
  });
});