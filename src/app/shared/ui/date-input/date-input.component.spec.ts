import { TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { DateInputComponent } from './date-input.component';

function setup(inputs: Record<string, unknown> = {}) {
  TestBed.configureTestingModule({ imports: [DateInputComponent] });
  const fixture = TestBed.createComponent(DateInputComponent);
  fixture.componentRef.setInput('inputId', 'due');
  for (const [name, value] of Object.entries(inputs)) fixture.componentRef.setInput(name, value);
  fixture.detectChanges();
  const input = (fixture.nativeElement as HTMLElement).querySelector('input') as HTMLInputElement;
  const onChange = vi.fn();
  const onTouched = vi.fn();
  fixture.componentInstance.registerOnChange(onChange);
  fixture.componentInstance.registerOnTouched(onTouched);
  return { fixture, input, onChange, onTouched };
}

describe('DateInput', () => {
  it('shows the written value', () => {
    const { fixture, input } = setup();
    fixture.componentInstance.writeValue('2026-11-17');
    fixture.detectChanges();
    expect(input.value).toBe('2026-11-17');
    expect(input.id).toBe('due');
    expect(input.type).toBe('date');
  });

  it('emits the date string and null when cleared', () => {
    const { input, onChange } = setup();
    input.value = '2026-12-01';
    input.dispatchEvent(new Event('input'));
    expect(onChange).toHaveBeenLastCalledWith('2026-12-01');
    input.value = '';
    input.dispatchEvent(new Event('input'));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it('sets min and max', () => {
    const { input } = setup({ min: '2026-01-01', max: '2026-12-31' });
    expect(input.getAttribute('min')).toBe('2026-01-01');
    expect(input.getAttribute('max')).toBe('2026-12-31');
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