import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { NumberInputComponent } from './number-input.component';

function setup(inputs: Record<string, unknown> = {}) {
  TestBed.configureTestingModule({ imports: [NumberInputComponent] });
  const fixture = TestBed.createComponent(NumberInputComponent);
  fixture.componentRef.setInput('inputId', 'qty');
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
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

describe('NumberInput', () => {
  it('shows the written value', () => {
    const { fixture, input } = setup();
    fixture.componentInstance.writeValue(5);
    fixture.detectChanges();
    expect(input.value).toBe('5');
    expect(input.id).toBe('qty');
  });

  it('emits a number when typing', () => {
    const { input, onChange } = setup();
    type(input, '7');
    expect(onChange).toHaveBeenLastCalledWith(7);
  });

  it('emits null when cleared', () => {
    const { input, onChange } = setup();
    type(input, '7');
    type(input, '');
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('sets min, max and step attributes', () => {
    const { input } = setup({ min: 1, max: 99, step: 1 });
    expect(input.getAttribute('min')).toBe('1');
    expect(input.getAttribute('max')).toBe('99');
    expect(input.getAttribute('step')).toBe('1');
    expect(input.getAttribute('inputmode')).toBe('numeric');
  });

  it('uses the decimal keyboard for fractional steps', () => {
    const { input } = setup({ step: 0.5 });
    expect(input.getAttribute('inputmode')).toBe('decimal');
  });

  it('marks touched on blur and can be disabled', () => {
    const { fixture, input, onTouched } = setup();
    input.dispatchEvent(new Event('blur'));
    expect(onTouched).toHaveBeenCalled();
    fixture.componentInstance.setDisabledState(true);
    fixture.detectChanges();
    expect(input.disabled).toBe(true);
  });
});